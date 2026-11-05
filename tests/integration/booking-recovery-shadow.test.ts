import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createPool, one } from '../../backend/platform/src/db.ts';
import { migrate } from '../../backend/platform/src/migrate.ts';
import { seed } from '../../backend/platform/src/seed.ts';
import { processBookingRecoveryShadow } from '../../backend/platform/src/worker.ts';

test('booking recovery shadow consumer is idempotent and non-executable', {
  skip: !process.env.TEST_DATABASE_URL,
  timeout: 60000,
}, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const recoveryIds: string[] = [];
  try {
    const database = await one(pool, 'SELECT current_database() AS name');
    assert.match(String(database?.name), /_test_db$/, 'only the isolated test database may be used');
    await migrate(pool);
    await seed(pool, 'Integration-only-passphrase-42!');

    const offering = await one<{ offering_id: string }>(
      pool,
      `SELECT o.offering_id
       FROM seven.offerings o
       JOIN seven.sectors s USING(sector_id)
       JOIN seven.businesses b USING(business_id)
       JOIN seven.workflow_states ws USING(workflow_state_id)
       WHERE s.sector_code='STAY' AND o.is_published
         AND ws.workflow_state_code='APPROVED'
       ORDER BY o.offering_id LIMIT 1`,
    );
    assert.ok(offering, 'seed must provide an approved published stay offering');

    for (const event of ['PAYMENT_FAILED', 'ABANDON'] as const) {
      const recoveryEventId = randomUUID();
      recoveryIds.push(recoveryEventId);
      await pool.query(
        `INSERT INTO seven.booking_recovery_events(
           recovery_event_id,event_id,session_id,offering_id,event_code,
           contact_channel,contact_consent,occurred_at
         ) VALUES($1,$2,$3,$4,$5,'NONE',false,now())`,
        [recoveryEventId, randomUUID(), randomUUID(), offering.offering_id, event],
      );
    }

    assert.equal(await processBookingRecoveryShadow(pool), 2);
    assert.equal(await processBookingRecoveryShadow(pool), 0);

    const decisions = await pool.query(
      `SELECT e.event_code,d.action_code,d.execution_mode,d.may_contact_guest,
              d.requires_human_approval,d.decision_payload
       FROM seven.booking_recovery_shadow_decisions d
       JOIN seven.booking_recovery_events e USING(recovery_event_id)
       WHERE d.recovery_event_id = ANY($1::uuid[])
       ORDER BY e.event_code`,
      [recoveryIds],
    );
    assert.equal(decisions.rows.length, 2);
    const payment = decisions.rows.find((row) => row.event_code === 'PAYMENT_FAILED');
    assert.equal(payment?.action_code, 'REVIEW_PAYMENT_ISSUE');
    assert.equal(payment?.requires_human_approval, true);
    assert.equal(payment?.may_contact_guest, false);
    assert.equal(payment?.execution_mode, 'SHADOW');
    assert.equal(payment?.decision_payload.evidenceTrust, 'UNVERIFIED_CLIENT_TELEMETRY');

    const abandon = decisions.rows.find((row) => row.event_code === 'ABANDON');
    assert.equal(abandon?.action_code, 'REQUEST_PMS_REFRESH');
    assert.equal(abandon?.may_contact_guest, false);
    assert.equal(abandon?.decision_payload.evidenceTrust, 'UNVERIFIED_CLIENT_TELEMETRY');
    assert.equal(abandon?.decision_payload.evidence.inventorySource, 'UNKNOWN');
  } finally {
    if (recoveryIds.length) {
      await pool.query(
        'DELETE FROM seven.booking_recovery_shadow_decisions WHERE recovery_event_id = ANY($1::uuid[])',
        [recoveryIds],
      );
      await pool.query(
        'DELETE FROM seven.booking_recovery_events WHERE recovery_event_id = ANY($1::uuid[])',
        [recoveryIds],
      );
    }
    await pool.end();
  }
});
