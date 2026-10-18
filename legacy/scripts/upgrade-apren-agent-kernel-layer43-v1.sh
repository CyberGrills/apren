#!/bin/bash
set -e

echo "=== Creating āprən Agent Kernel Layer 43 schema ==="

docker exec -i apren-postgres psql \
  -U apren \
  -d apren <<'SQL'

CREATE TABLE IF NOT EXISTS food_brain_agent_runs (
  run_id UUID PRIMARY KEY,
  asset_id INTEGER,
  goal TEXT NOT NULL,
  autonomy_mode VARCHAR(32) NOT NULL DEFAULT 'ASSISTED',
  status VARCHAR(64) NOT NULL DEFAULT 'CREATED',
  input_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_decision JSONB,
  execution_result JSONB,
  verification_result JSONB,
  learning_result JSONB,
  error JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_asset
ON food_brain_agent_runs(asset_id);

CREATE INDEX IF NOT EXISTS idx_agent_runs_status
ON food_brain_agent_runs(status);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created
ON food_brain_agent_runs(created_at);


CREATE TABLE IF NOT EXISTS food_brain_agent_run_steps (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES food_brain_agent_runs(run_id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
  input_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  error JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(run_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run
ON food_brain_agent_run_steps(run_id);

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_order
ON food_brain_agent_run_steps(run_id, step_order);


CREATE TABLE IF NOT EXISTS food_brain_agent_verifications (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES food_brain_agent_runs(run_id) ON DELETE CASCADE,
  action VARCHAR(128) NOT NULL,
  expected_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_verifications_run
ON food_brain_agent_verifications(run_id);


CREATE TABLE IF NOT EXISTS food_brain_agent_learning_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES food_brain_agent_runs(run_id) ON DELETE CASCADE,
  signal VARCHAR(128) NOT NULL,
  reward NUMERIC NOT NULL DEFAULT 0,
  lesson JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_learning_run
ON food_brain_agent_learning_events(run_id);

CREATE INDEX IF NOT EXISTS idx_agent_learning_signal
ON food_brain_agent_learning_events(signal);

SQL

echo "=== Agent Kernel schema ready ==="
