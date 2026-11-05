import type {
  Activity,
  AdminRecordsPage,
  Business,
  Payment,
  SessionUser,
  Reservation,
} from '@7even/contracts';
import type { Express, Response } from 'express';
import type { Pool, QueryResultRow } from 'pg';
import { z } from 'zod';
import { fail, one, rows } from './db.ts';
import * as S from './store.ts';

const pageNumber = (maximum: number, fallback: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(maximum))
    .default(fallback);
const baseQuery = z.strictObject({
  q: z.string().trim().max(160).default(''),
  page: pageNumber(10000, 1),
  pageSize: pageNumber(50, 25),
  businessId: z.uuid().optional(),
});
type Filters = z.infer<typeof baseQuery> & { status?: string };
interface RecordSource {
  from: string;
  id: string;
  createdAt: string;
  searchable: string;
  businessId: string;
  selection?: string;
}
interface AdminRecordsContext {
  pool: Pool;
  actor: (res: Response) => SessionUser;
}

export function mountAdminRecords(app: Express, { pool, actor }: AdminRecordsContext): void {
  const page = async <T>(
    input: Filters,
    source: RecordSource,
    project: (record: QueryResultRow) => Promise<T | null> | T,
  ): Promise<AdminRecordsPage<T>> => {
    const values: unknown[] = [input.q];
    const conditions = [
      `($1::text='' OR strpos(lower(concat_ws(' ',${source.searchable})),lower($1))>0)`,
    ];
    if (input.businessId) {
      values.push(input.businessId);
      conditions.push(`${source.businessId}=$${values.length}::uuid`);
    }
    if (input.status) {
      values.push(input.status);
      conditions.push(`ws.workflow_state_code=$${values.length}`);
    }
    const where = conditions.join(' AND ');
    const [count, selected] = await Promise.all([
      one(pool, `SELECT count(*) AS total FROM ${source.from} WHERE ${where}`, values),
      rows(
        pool,
        `SELECT ${source.selection ?? `${source.id} AS record_id`} FROM ${source.from}
         WHERE ${where} ORDER BY ${source.createdAt} DESC,${source.id} DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, input.pageSize, (input.page - 1) * input.pageSize],
      ),
    ]);
    const projected = await Promise.all(selected.map(project));
    return {
      items: projected.filter((item) => item !== null) as T[],
      total: Number(count?.total ?? 0),
      page: input.page,
      pageSize: input.pageSize,
    };
  };
  const get = <T>(
    path: string,
    schema: z.ZodType<Filters>,
    source: RecordSource,
    project: (record: QueryResultRow) => Promise<T | null> | T,
  ) =>
    app.get(`/api/admin/records/${path}`, async (req, res) => {
      if (actor(res).role !== 'ADMIN')
        fail(403, 'FORBIDDEN', 'Platform administration access is required.');
      res.json({ data: await page(schema.parse(req.query), source, project) });
    });

  get<Business>(
    'businesses',
    baseQuery.extend({
      status: z.enum(['PENDING', 'APPROVED', 'SUSPENDED']).optional(),
    }),
    {
      from: 'seven.businesses b JOIN seven.workflow_states ws USING(workflow_state_id)',
      id: 'b.business_id',
      createdAt: 'b.created_at',
      businessId: 'b.business_id',
      searchable: "b.business_name,b.city,b.details->>'state',b.business_id::text",
    },
    (record) => S.businessProjection(pool, record.record_id),
  );

  const reservationQuery = baseQuery.extend({
    status: z
      .enum([
        'HELD',
        'CONFIRMED',
        'CHECKED_IN',
        'FULFILLED',
        'CANCELLED',
        'EXPIRED',
        'PAYMENT_REVIEW',
      ])
      .optional(),
  });
  const reservationSource: RecordSource = {
    from: `seven.reservations r JOIN seven.workflow_states ws ON ws.workflow_state_id=r.workflow_state_id
           JOIN seven.offerings o USING(offering_id) JOIN seven.businesses b ON b.business_id=r.business_id
           JOIN seven.users u ON u.user_id=r.user_id JOIN seven.quotes q USING(quote_id)`,
    id: 'r.reservation_id',
    createdAt: 'r.created_at',
    businessId: 'r.business_id',
    searchable:
      "r.reservation_id::text,'7E-'||upper(left(r.reservation_id::text,8)),u.display_name,u.email,o.title,b.business_name,q.terms_snapshot->>'title'",
  };
  const projectReservation = (record: QueryResultRow) =>
    S.reservationProjection(pool, record.record_id);
  get<Reservation>('reservations', reservationQuery, reservationSource, projectReservation);

  const ownerReservationQuery = reservationQuery.omit({ businessId: true });
  app.get('/api/business/records/reservations', async (req, res) => {
    const owner = actor(res);
    if (owner.role !== 'BUSINESS_OWNER')
      fail(403, 'FORBIDDEN', 'Business owner access is required.');
    const businessId = owner.businessId;
    if (!businessId)
      return fail(403, 'BUSINESS_REQUIRED', 'An active business membership is required.');
    const input = ownerReservationQuery.parse(req.query);
    res.json({
      data: await page<Reservation>(
        { ...input, businessId },
        reservationSource,
        projectReservation,
      ),
    });
  });

  get<Payment>(
    'payments',
    baseQuery.extend({
      status: z
        .enum([
          'UNPAID',
          'PENDING',
          'PAID',
          'FAILED',
          'UNKNOWN',
          'REFUND_PENDING',
          'REFUNDED',
          'REVIEW_REQUIRED',
        ])
        .optional(),
    }),
    {
      from: `seven.payment_attempts p JOIN seven.workflow_states ws ON ws.workflow_state_id=p.workflow_state_id
           JOIN seven.reservations r USING(reservation_id) JOIN seven.businesses b ON b.business_id=r.business_id`,
      id: 'p.payment_attempt_id',
      createdAt: 'p.created_at',
      businessId: 'r.business_id',
      searchable:
        'p.merchant_reference,p.provider_transaction_id,p.payment_attempt_id::text,r.reservation_id::text,b.business_name',
    },
    (record) => S.paymentProjection(pool, record.record_id),
  );

  get<Activity>(
    'audit',
    baseQuery,
    {
      from: `seven.audit_events a LEFT JOIN seven.users u USING(user_id)
           LEFT JOIN seven.businesses b USING(business_id)`,
      id: 'a.audit_event_id',
      createdAt: 'a.created_at',
      businessId: 'a.business_id',
      searchable: "a.action_code,a.resource_id,u.display_name,a.details->>'detail',b.business_name",
      selection:
        'a.audit_event_id,a.action_code,a.resource_id,a.created_at,a.details,u.display_name',
    },
    (record) => ({
      id: record.audit_event_id,
      action: record.action_code,
      actorName: record.display_name ?? '7even',
      entityType: record.action_code.split('.')[0],
      entityId: record.resource_id ?? '',
      createdAt: S.iso(record.created_at),
      detail: record.details.detail ?? '',
    }),
  );
}
