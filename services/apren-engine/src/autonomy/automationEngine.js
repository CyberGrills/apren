const { pool } = require("../postgres");
const guard = require("./executionGuard");

async function execute(actionId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const action = await client.query(
      `
      SELECT *
      FROM food_brain_actions_queue
      WHERE id = $1
      FOR UPDATE
      `,
      [actionId]
    );

    if (!action.rows[0]) {
      throw new Error("Action not found");
    }

    const item = action.rows[0];

    if (item.status !== "PENDING") {
      throw new Error("Action has already been processed; only PENDING actions can be simulated.");
    }

    const permission = guard.validate(item.action);
    const status = permission.allowed ? "SIMULATED" : "BLOCKED";

    await client.query(
      `
      UPDATE food_brain_actions_queue
      SET status = $1
      WHERE id = $2
      `,
      [status, actionId]
    );

    const log = await client.query(
      `
      INSERT INTO food_brain_execution_log
      (
        action_id,
        asset_id,
        result,
        impact
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        actionId,
        item.asset_id,
        status,
        permission.reason
      ]
    );

    await client.query("COMMIT");
    return log.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  execute
};
