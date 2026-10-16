ALTER TABLE hospitality_payments
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS provider_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_payments_refund_status_check') THEN
    ALTER TABLE hospitality_payments ADD CONSTRAINT hospitality_payments_refund_status_check
      CHECK (refund_status IN ('none', 'pending', 'processing', 'processed', 'failed', 'needs_attention'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospitality_payments_refund_amount_check') THEN
    ALTER TABLE hospitality_payments ADD CONSTRAINT hospitality_payments_refund_amount_check
      CHECK (refund_amount_minor IS NULL OR refund_amount_minor >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitality_payments_provider_refund_id
  ON hospitality_payments(provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;
