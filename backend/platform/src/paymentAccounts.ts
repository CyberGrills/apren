import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Pool } from 'pg';
import { getAddress, isAddress } from 'viem';
import * as C from '@7even/contracts';
import { fail, one } from './db.ts';
import type { Connection } from './db.ts';
import { buildBusinessWalletMessage, verifyEoaSignature } from './cryptoProvider.ts';
import { ProviderRegistry, providerIds, executionModeIds } from './providerRegistry.ts';
import type { ProviderSource } from './providerRegistry.ts';
import * as S from './store.ts';

interface PaymentAccountsContext {
  route: (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    handler: (req: Request, res: Response) => Promise<unknown>,
  ) => void;
  mutate: <T>(
    req: Request,
    res: Response,
    work: (db: Connection, actor: C.SessionUser) => Promise<T>,
  ) => Promise<T>;
  pool: Pool;
  source: ProviderSource;
  actorFor: (res: Response) => C.SessionUser;
  requireRole: (actor: C.SessionUser, roles: C.Role[]) => void;
  id: (req: Request) => string;
}

const WALLET_PROOF_TTL = 5 * 60_000;

function walletAddress(value: unknown): string {
  if (typeof value !== 'string' || !isAddress(value) || /^0x0{40}$/i.test(value))
    return fail(422, 'INVALID_WALLET', 'Enter a valid nonzero Base wallet address.');
  return getAddress(value);
}

/** Wallet registration has no chain I/O. Only an explicitly reviewed public address is retained. */
export function mountPaymentAccounts(context: PaymentAccountsContext): void {
  const { route, mutate, pool, source, actorFor, requireRole, id } = context;
  const chainId = () => {
    const gateway = source instanceof ProviderRegistry ? source.crypto : null;
    const configured =
      gateway && 'chainId' in gateway
        ? gateway.chainId
        : Number(process.env.CRYPTO_CHAIN_ID ?? '84532');
    if (configured !== 8453 && configured !== 84532)
      return fail(
        503,
        'CRYPTO_NETWORK_UNAVAILABLE',
        'A supported Base network must be configured.',
      );
    return configured;
  };
  const owner = (user: C.SessionUser) => {
    requireRole(user, ['BUSINESS_OWNER']);
    if (!user.businessId)
      return fail(403, 'BUSINESS_REQUIRED', 'An active business owner membership is required.');
    return { actor: user, businessId: user.businessId };
  };
  const projection = async (db: Connection, businessId: string) => {
    const business = await S.businessProjection(db, businessId);
    return business ?? fail(404, 'NOT_FOUND', 'Business not found.');
  };
  const assertProofExpiry = (value: string): string => {
    const expires = Date.parse(value);
    const now = Date.now();
    if (!Number.isFinite(expires) || expires <= now || expires > now + WALLET_PROOF_TTL)
      return fail(
        422,
        'WALLET_PROOF_EXPIRED',
        'Request a new wallet proof and sign it within five minutes.',
      );
    return new Date(expires).toISOString();
  };

  route('get', '/business/payment-accounts', async (_req, res) => {
    const { businessId } = owner(actorFor(res));
    const business = await projection(pool, businessId);
    return {
      accounts: business.paymentAccounts ?? [],
      commissionOwedMinor: business.cryptoCommissionOwedMinor ?? '0',
      chainId: chainId(),
    };
  });

  route('get', '/business/payment-wallet-challenge', async (req, res) => {
    const { businessId } = owner(actorFor(res));
    const address = walletAddress(req.query.address);
    const business = await projection(pool, businessId);
    const revision =
      business.paymentAccounts?.find((account) => account.provider === 'crypto')?.revision ?? 0;
    const expiresAt = new Date(Date.now() + WALLET_PROOF_TTL).toISOString();
    return {
      revision,
      expiresAt,
      message: buildBusinessWalletMessage({
        reference: `business:${businessId}:revision:${revision}`,
        venueId: businessId,
        chainId: chainId(),
        walletAddress: address,
        expiresAt,
      }),
    };
  });

  route('post', '/business/payment-wallet', async (req, res) => {
    const { businessId } = owner(actorFor(res));
    const input = C.cryptoWalletInput.parse(req.body);
    const address = walletAddress(input.walletAddress);
    // Normalize ISO offsets to the exact UTC message emitted by the challenge endpoint.
    const expiresAt = new Date(input.expiresAt).toISOString();
    const network = chainId();
    const message = buildBusinessWalletMessage({
      reference: `business:${businessId}:revision:${input.expectedRevision}`,
      venueId: businessId,
      chainId: network,
      walletAddress: address,
      expiresAt,
    });
    if (!(await verifyEoaSignature({ address, message, signature: input.signature })))
      return fail(
        422,
        'WALLET_PROOF_INVALID',
        'Sign the current wallet proof with this receiving wallet.',
      );
    return mutate(req, res, async (db, user) => {
      const currentOwner = owner(user);
      if (currentOwner.businessId !== businessId)
        return fail(403, 'FORBIDDEN', 'This wallet proof belongs to another business.');
      S.requireTenant(user, businessId, true);
      const business = await one(
        db,
        'SELECT business_id FROM seven.businesses WHERE business_id=$1 FOR UPDATE',
        [businessId],
      );
      if (!business) return fail(404, 'NOT_FOUND', 'Business not found.');
      const current = await one(
        db,
        'SELECT * FROM seven.business_payment_accounts WHERE business_id=$1 AND payment_provider_id=$2 FOR UPDATE',
        [businessId, providerIds.crypto],
      );
      if (Number(current?.revision ?? 0) !== input.expectedRevision)
        return fail(
          409,
          'REVISION_CONFLICT',
          'This wallet changed. Refresh and sign a new wallet proof.',
        );
      assertProofExpiry(expiresAt);
      const details = {
        ownershipMessage: message,
        ownershipVerifiedAt: new Date().toISOString(),
        chainId: network,
      };
      const executionMode =
        source.mode === 'mock' ? executionModeIds.mock : executionModeIds.crypto;
      if (current) {
        await db.query(
          `UPDATE seven.business_payment_accounts SET account_code=$2,account_label=$3,execution_mode_id=$4,
           revision=revision+1,workflow_state_id=${S.sid('PENDING')},details=$5,verified_at=NULL,updated_at=now()
           WHERE business_payment_account_id=$1`,
          [
            current.business_payment_account_id,
            address,
            'USDC on Base wallet',
            executionMode,
            details,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO seven.business_payment_accounts(business_payment_account_id,business_id,payment_provider_id,
           account_code,account_label,execution_mode_id,revision,workflow_state_id,details,verified_at)
           VALUES($1,$2,$3,$4,$5,$6,1,${S.sid('PENDING')},$7,NULL)`,
          [
            randomUUID(),
            businessId,
            providerIds.crypto,
            address,
            'USDC on Base wallet',
            executionMode,
            details,
          ],
        );
      }
      await S.audit(
        db,
        user,
        businessId,
        'business.crypto_wallet.submitted',
        businessId,
        'Receiving wallet ownership verified. Administrator review is required before checkout.',
      );
      return projection(db, businessId);
    });
  });

  route('post', '/admin/businesses/:id/crypto-wallet/approve', async (req, res) => {
    requireRole(actorFor(res), ['ADMIN']);
    const businessId = id(req);
    const input = C.cryptoWalletApprovalInput.parse(req.body);
    return mutate(req, res, async (db, user) => {
      requireRole(user, ['ADMIN']);
      const business = await one(
        db,
        'SELECT business_id FROM seven.businesses WHERE business_id=$1 FOR UPDATE',
        [businessId],
      );
      if (!business) return fail(404, 'NOT_FOUND', 'Business not found.');
      const account = await one(
        db,
        `SELECT a.*,s.workflow_state_code FROM seven.business_payment_accounts a
         JOIN seven.workflow_states s USING(workflow_state_id)
         WHERE a.business_id=$1 AND a.payment_provider_id=$2 FOR UPDATE OF a`,
        [businessId, providerIds.crypto],
      );
      if (!account) return fail(404, 'NOT_FOUND', 'A business wallet has not been submitted.');
      if (Number(account.revision) !== input.expectedRevision)
        return fail(409, 'REVISION_CONFLICT', 'This wallet changed. Refresh before reviewing it.');
      if (account.workflow_state_code !== 'PENDING')
        return fail(
          409,
          'WALLET_REVIEW_NOT_PENDING',
          'Only a pending wallet submission can be reviewed.',
        );
      if (input.approved) {
        const expectedMode =
          source.mode === 'mock' ? executionModeIds.mock : executionModeIds.crypto;
        if (
          Number(account.execution_mode_id) !== expectedMode ||
          account.details.chainId !== chainId()
        )
          return fail(
            409,
            'WALLET_NETWORK_CHANGED',
            'The configured payment network changed. Ask the business to submit its wallet again.',
          );
        if (!account.details.ownershipMessage || !account.details.ownershipVerifiedAt)
          return fail(
            409,
            'WALLET_PROOF_REQUIRED',
            'The business must prove control of this wallet before approval.',
          );
        walletAddress(account.account_code);
      }
      await db.query(
        `UPDATE seven.business_payment_accounts SET workflow_state_id=${S.sid(input.approved ? 'APPROVED' : 'REJECTED')},
         revision=revision+1,verified_at=CASE WHEN $2 THEN now() ELSE NULL END,
         details=details || $3::jsonb,updated_at=now() WHERE business_payment_account_id=$1`,
        [
          account.business_payment_account_id,
          input.approved,
          {
            reviewedBy: user.id,
            reviewedAt: new Date().toISOString(),
            reviewReason: input.reason,
          },
        ],
      );
      await S.audit(
        db,
        user,
        businessId,
        input.approved ? 'business.crypto_wallet.approved' : 'business.crypto_wallet.rejected',
        businessId,
        input.reason,
      );
      return projection(db, businessId);
    });
  });
}
