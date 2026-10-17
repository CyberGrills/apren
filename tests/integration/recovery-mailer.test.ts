import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configuredRecoveryMailer,
  recoveryDelivery,
} from '../../services/platform/src/recoveryMailer.ts';
test('recovery SMTP remains disabled with no configuration and rejects partial or insecure settings', () => {
  assert.equal(configuredRecoveryMailer({}), undefined);
  assert.throws(() => configuredRecoveryMailer({ SMTP_HOST: 'smtp.example.test' }));
  assert.throws(() =>
    configuredRecoveryMailer({
      SMTP_HOST: 'smtp.example.test',
      SMTP_USER: 'test',
      SMTP_PASSWORD: 'test',
      SMTP_FROM: 'accounts@example.test',
      SMTP_PORT: '25',
    }),
  );
});
test('the recovery adapter addresses only the requested recipient and disables URL/file fetching', async () => {
  let message: Record<string, unknown> | null = null;
  const send = recoveryDelivery(
    {
      async sendMail(input) {
        message = input;
      },
    },
    'accounts@example.test',
  );
  await send({
    to: 'guest@example.test',
    recoveryUrl: 'https://seven.example.test/reset-password?token=fixture-only',
    expiresAt: '2026-10-16T12:15:00.000Z',
  });
  assert.ok(message);
  assert.equal(message['to'], 'guest@example.test');
  assert.equal(message['disableUrlAccess'], true);
  assert.equal(message['disableFileAccess'], true);
  assert.match(String(message['text']), /fixture-only/);
});
test('complete TLS configuration creates a lazy sender without connecting', () => {
  const send = configuredRecoveryMailer({
    SMTP_HOST: 'smtp.example.test',
    SMTP_USER: 'fixture',
    SMTP_PASSWORD: 'fixture-only',
    SMTP_FROM: 'accounts@example.test',
    SMTP_PORT: '465',
  });
  assert.equal(typeof send, 'function');
});
