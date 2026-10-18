const { pool } = require("../postgres");

async function createRun({
  runId,
  assetId,
  goal,
  autonomyMode,
  input
}) {
  const result = await pool.query(
    `
    INSERT INTO food_brain_agent_runs
    (
      run_id,
      asset_id,
      goal,
      autonomy_mode,
      input_state
    )
    VALUES
    ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      runId,
      assetId || null,
      goal,
      autonomyMode || "ASSISTED",
      JSON.stringify(input || {})
    ]
  );

  return result.rows[0];
}

async function updateRun(runId, fields) {
  const allowed = [
    "status",
    "input_state",
    "final_decision",
    "execution_result",
    "verification_result",
    "learning_result",
    "error",
    "completed_at"
  ];

  const entries = Object.entries(fields)
    .filter(([key]) => allowed.includes(key));

  if (!entries.length) {
    return null;
  }

  const values = [];
  const assignments = entries.map(([key, value], index) => {
    values.push(
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : value
    );

    return `${key}=$${index + 1}`;
  });

  values.push(runId);

  const result = await pool.query(
    `
    UPDATE food_brain_agent_runs
    SET
      ${assignments.join(",")},
      updated_at=CURRENT_TIMESTAMP
    WHERE run_id=$${values.length}
    RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function addStep({
  runId,
  order,
  name,
  status,
  input = null,
  output = null,
  error = null
}) {
  const normalizedInput =
    input === null || input === undefined
      ? {}
      : input;

  const normalizedOutput =
    output === null || output === undefined
      ? {}
      : output;

  const normalizedError =
    error === null || error === undefined
      ? null
      : error;

  const existing = await pool.query(
    `
    SELECT id
    FROM food_brain_agent_run_steps
    WHERE run_id=$1::uuid
      AND step_order=$2::integer
    ORDER BY id ASC
    LIMIT 1
    `,
    [
      String(runId),
      Number(order)
    ]
  );

  if (existing.rows[0]) {
    const result = await pool.query(
      `
      UPDATE food_brain_agent_run_steps
      SET
        step_name=$1::varchar,
        status=$2::varchar,
        input_state=$3::jsonb,
        output_state=$4::jsonb,
        error=$5::jsonb,
        completed_at=
          CASE
            WHEN $2::varchar IN ('COMPLETED','FAILED','SKIPPED')
            THEN CURRENT_TIMESTAMP
            ELSE NULL
          END
      WHERE id=$6::bigint
      RETURNING *
      `,
      [
        String(name),
        String(status),
        JSON.stringify(normalizedInput),
        JSON.stringify(normalizedOutput),
        normalizedError === null
          ? null
          : JSON.stringify(normalizedError),
        Number(existing.rows[0].id)
      ]
    );

    return result.rows[0];
  }

  const result = await pool.query(
    `
    INSERT INTO food_brain_agent_run_steps
    (
      run_id,
      step_order,
      step_name,
      status,
      input_state,
      output_state,
      error,
      completed_at
    )
    VALUES
    (
      $1::uuid,
      $2::integer,
      $3::varchar,
      $4::varchar,
      $5::jsonb,
      $6::jsonb,
      $7::jsonb,
      CASE
        WHEN $4::varchar IN ('COMPLETED','FAILED','SKIPPED')
        THEN CURRENT_TIMESTAMP
        ELSE NULL
      END
    )
    RETURNING *
    `,
    [
      String(runId),
      Number(order),
      String(name),
      String(status),
      JSON.stringify(normalizedInput),
      JSON.stringify(normalizedOutput),
      normalizedError === null
        ? null
        : JSON.stringify(normalizedError)
    ]
  );

  return result.rows[0];
}

async function getRun(runId) {
  const run = await pool.query(
    `
    SELECT *
    FROM food_brain_agent_runs
    WHERE run_id=$1
    `,
    [runId]
  );

  if (!run.rows[0]) {
    return null;
  }

  const steps = await pool.query(
    `
    SELECT *
    FROM food_brain_agent_run_steps
    WHERE run_id=$1
    ORDER BY step_order ASC
    `,
    [runId]
  );

  const verification = await pool.query(
    `
    SELECT *
    FROM food_brain_agent_verifications
    WHERE run_id=$1
    ORDER BY id ASC
    `,
    [runId]
  );

  const learning = await pool.query(
    `
    SELECT *
    FROM food_brain_agent_learning_events
    WHERE run_id=$1
    ORDER BY id ASC
    `,
    [runId]
  );

  return {
    run: run.rows[0],
    steps: steps.rows,
    verifications: verification.rows,
    learning: learning.rows
  };
}

module.exports = {
  createRun,
  updateRun,
  addStep,
  getRun
};
