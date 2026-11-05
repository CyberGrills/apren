import { createRequire } from 'node:module';
import type { RecoveryMailer, RecoveryMessage } from './accounts.ts';

interface SmtpTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    disableFileAccess: boolean;
    disableUrlAccess: boolean;
  }): Promise<unknown>;
}
export function recoveryDelivery(
  transport: SmtpTransport,
  from: string,
): RecoveryMailer['sendRecovery'] {
  return async ({ to, recoveryUrl, expiresAt }: RecoveryMessage) => {
    const target = new URL(recoveryUrl);
    if (!['https:', 'http:'].includes(target.protocol) || target.username || target.password)
      throw new Error('Invalid account recovery address.');
    await transport.sendMail({
      from,
      to,
      subject: 'Reset your 7even password',
      text: `You asked to reset your 7even password.\n\nOpen this link before ${new Date(expiresAt).toISOString()}:\n${recoveryUrl}\n\nThis link works once. If you did not ask for it, leave your password as it is.\n\n7even`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  };
}
/** Configuration creates no connection. Sending happens only after an account request. */
export function configuredRecoveryMailer(
  environment: NodeJS.ProcessEnv = process.env,
): RecoveryMailer['sendRecovery'] | undefined {
  const {
    SMTP_HOST: host,
    SMTP_USER: user,
    SMTP_PASSWORD: password,
    SMTP_FROM: from,
  } = environment;
  if (![host, user, password, from].some(Boolean)) return undefined;
  if (
    !host ||
    !user ||
    !password ||
    !from ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from) ||
    /[\r\n]/.test(host + user + from)
  )
    throw new Error(
      'Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD and an email-only SMTP_FROM together.',
    );
  const port = Number(environment.SMTP_PORT ?? 465);
  if (port !== 465 && port !== 587) throw new Error('SMTP_PORT must be 465 or 587 with TLS.');
  // Load the configured transport only when delivery is requested. Local fixture mode has no network dependency.
  const options = {
    host,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  return async (message) => {
    const library = createRequire(import.meta.url)('nodemailer') as {
      createTransport(configuration: typeof options): SmtpTransport;
    };
    if (typeof library.createTransport !== 'function')
      throw new Error('SMTP transport is unavailable.');
    await recoveryDelivery(library.createTransport(options), from)(message);
  };
}
