-- Link hotel quotes to the pseudonymous browser recovery session that initiated them.
-- Existing quotes remain unattributed; no user identity or contact details are stored.
ALTER TABLE seven.quotes
  ADD COLUMN IF NOT EXISTS recovery_session_id uuid;

CREATE INDEX IF NOT EXISTS quotes_recovery_session_idx
  ON seven.quotes(recovery_session_id)
  WHERE recovery_session_id IS NOT NULL;

COMMENT ON COLUMN seven.quotes.recovery_session_id IS
  'Pseudonymous 7even recovery session UUID, used only to attribute a provider-verified hotel reservation outcome.';
