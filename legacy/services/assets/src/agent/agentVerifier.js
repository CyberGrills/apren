const { pool } = require("../postgres");

async function verify({
  runId,
  action,
  autonomyMode = "ASSISTED",
  authorization = null,
  expectedExecution = null,
  actualExecution = null
}) {
  let verified = false;
  let reason = "";

  if (autonomyMode === "ASSISTED") {

    verified = true;

    reason =
      "Decision plan verified; execution is intentionally pending human approval.";

  } else {

    const authorized =
      Boolean(
        authorization &&
        authorization.authorized
      );

    const expectedStatus = "SIMULATED";

    const actualStatus =
      actualExecution &&
      actualExecution.status
        ? actualExecution.status
        : null;

    const actualAction =
      actualExecution &&
      actualExecution.action
        ? actualExecution.action
        : null;

    verified =
      authorized &&
      actualStatus === expectedStatus &&
      actualAction === action;

    reason = verified
      ? "Authorized autonomous execution matched the simulated execution contract and approved action."
      : "Autonomous execution did not satisfy authorization, action matching, or simulated execution verification.";
  }

  const expectedResult =
    autonomyMode === "ASSISTED"
      ? {
          plan: "VERIFIED",
          execution: "PENDING_APPROVAL"
        }
      : expectedExecution || {};

  const actualResult =
    actualExecution || {};

  const result = await pool.query(
    `
    INSERT INTO food_brain_agent_verifications
    (
      run_id,
      action,
      expected_result,
      actual_result,
      verified,
      verification_reason
    )
    VALUES
    (
      $1::uuid,
      $2::varchar,
      $3::jsonb,
      $4::jsonb,
      $5::boolean,
      $6::text
    )
    RETURNING *
    `,
    [
      String(runId),
      String(action),
      JSON.stringify(expectedResult),
      JSON.stringify(actualResult),
      verified,
      reason
    ]
  );

  return result.rows[0];
}

module.exports = {
  verify
};
