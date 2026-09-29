const crypto = require("crypto");

const store = require("./agentRunStore");
const verifier = require("./agentVerifier");

const prediction =
  require("../prediction/predictiveBrain");

const simulation =
  require("../simulation/simulationBrain");

const collaboration =
  require("../agents/agentCollaborationEngine");

const decisionLoop =
  require("../cycle/decisionLoopEngine");

const strategy =
  require("../strategy/actionStrategyEngine");

const authorization =
  require("../execution/actionAuthorizationEngine");

const executionGateway =
  require("../execution/executionGatewayEngine");

const { pool } = require("../postgres");



async function buildAssetContext(assetId, inputData = {}) {
  const result = await pool.query(
    `
    SELECT
      id,
      food_id,
      asset_code,
      current_value,
      freshness_score,
      demand_score,
      trust_score,
      market_status,
      total_trades,
      available_supply,
      kitchen_price
    FROM food_assets
    WHERE id = $1::integer
    `,
    [assetId]
  );

  if (!result.rows.length) {
    throw new Error(`Food asset ${assetId} was not found.`);
  }

  const asset = result.rows[0];

  const freshness = Number(
    inputData.freshness ??
    asset.freshness_score ??
    0
  );

  const demandScore = Number(
    inputData.demand_score ??
    asset.demand_score ??
    0
  );

  const supplyAmount = Number(
    inputData.available_supply ??
    asset.available_supply ??
    0
  );

  const value = Number(
    inputData.value ??
    asset.current_value ??
    asset.kitchen_price ??
    0
  );

  const demand =
    inputData.demand ||
    (
      demandScore >= 80
        ? "HIGH"
        : demandScore >= 50
          ? "MEDIUM"
          : "LOW"
    );

  const supply =
    inputData.supply ||
    (
      supplyAmount <= 100
        ? "LOW"
        : "NORMAL"
    );

  return {
    asset_id: asset.id,
    food_id: asset.food_id,
    asset_code: asset.asset_code,

    freshness,
    freshness_score: Number(
      asset.freshness_score ?? freshness
    ),

    demand,
    demand_score: demandScore,

    supply,
    available_supply: supplyAmount,

    value,
    current_value: Number(
      asset.current_value ?? value
    ),
    kitchen_price: Number(
      asset.kitchen_price ?? value
    ),

    trust: Number(
      asset.trust_score ?? 0
    ),
    trust_score: Number(
      asset.trust_score ?? 0
    ),

    market_status: asset.market_status ?? null,

    total_trades: Number(
      asset.total_trades ?? 0
    ),

    input: inputData
  };
}

function makeRunId() {
  return crypto.randomUUID();
}


async function step(runId, order, name, fn, input) {
  await store.addStep({
    runId,
    order,
    name,
    status: "RUNNING",
    input
  });

  try {
    const output = await fn();

    await store.addStep({
      runId,
      order,
      name,
      status: "COMPLETED",
      input,
      output
    });

    return output;

  } catch (error) {

    await store.addStep({
      runId,
      order,
      name,
      status: "FAILED",
      input,
      error: {
        message: error.message,
        stack: error.stack
      }
    });

    throw error;
  }
}


async function learn(runId, verification) {
  const expectedResult =
    verification &&
    verification.expected_result
      ? verification.expected_result
      : {};

  const isPlanVerification =
    expectedResult.plan === "VERIFIED";

  const signal = isPlanVerification
    ? "PLAN_READY"
    : verification.verified
      ? "EXECUTION_SUCCESS"
      : "EXECUTION_FAILURE";

  const reward = isPlanVerification
    ? 0
    : verification.verified
      ? 1
      : -1;

  const lesson = {
    verification_id: verification.id,
    verified: verification.verified,
    reason: verification.verification_reason,
    learning_scope: isPlanVerification
      ? "PLAN"
      : "EXECUTION"
  };

  const result = await pool.query(
    `
    INSERT INTO food_brain_agent_learning_events
    (
      run_id,
      signal,
      reward,
      lesson
    )
    VALUES
    (
      $1::uuid,
      $2::varchar,
      $3::numeric,
      $4::jsonb
    )
    RETURNING *
    `,
    [
      String(runId),
      signal,
      reward,
      JSON.stringify(lesson)
    ]
  );

  return result.rows[0];
}


async function run({
  assetId,
  goal,
  data,
  autonomyMode = "ASSISTED"
}) {

  if (!goal) {
    throw new Error("Agent goal is required");
  }

  const runId = makeRunId();

  await store.createRun({
    runId,
    assetId,
    goal,
    autonomyMode,
    input: data || {}
  });

  await store.updateRun(runId, {
    status: "RUNNING"
  });

  try {

    const context = await buildAssetContext(
      assetId,
      data || {}
    );

    await store.updateRun(runId, {
      input_state: context
    });

    const predictive =
      await step(
        runId,
        1,
        "PREDICTION",
        () =>
          prediction.predict(
            assetId,
            context
          ),
        context
      );


    const simulated =
      await step(
        runId,
        2,
        "SIMULATION",
        () =>
          simulation.simulate(
            assetId,
            context
          ),
        context
      );


    const agents =
      await step(
        runId,
        3,
        "MULTI_AGENT_COLLABORATION",
        () =>
          collaboration.collaborate(
            assetId,
            context
          ),
        context
      );


    const decision =
      await step(
        runId,
        4,
        "DECISION",
        () =>
          decisionLoop.run(
            assetId,
            context
          ),
        context
      );


    const finalStrategy =
      await step(
        runId,
        5,
        "STRATEGY",
        () => ({
          strategy: decision.strategy.strategy,
          steps: decision.strategy.steps
        }),
        context
      );


    const finalDecision = {
      action: decision.decision.action,
      confidence: decision.decision.confidence,
      steps: finalStrategy.steps,
      reasoning: {
        prediction:
          predictive.prediction,
        simulation:
          simulated.recommended_path,
        agents:
          agents.consensus,
        decision
      }
    };


    await store.updateRun(runId, {
      final_decision: finalDecision
    });


    let authorizationResult = {
      status: "SKIPPED",
      reason: "ASSISTED mode requires human approval."
    };

    let execution = {
      status: "SKIPPED",
      reason: "Execution awaiting human approval.",
      action: finalDecision.action
    };


    if (autonomyMode === "AUTONOMOUS") {

      authorizationResult =
        await step(
          runId,
          6,
          "AUTHORIZATION",
          () =>
            authorization.authorize(
              finalDecision.action
            ),
          finalDecision
        );

      if (!authorizationResult.authorized) {

        execution = await step(
          runId,
          7,
          "EXECUTION",
          () => ({
            status: "BLOCKED",
            action: finalDecision.action,
            reason:
              authorizationResult.reason ||
              "Execution blocked by authorization.",
            authorization:
              authorizationResult
          }),
          {
            action: finalDecision.action,
            authorization:
              authorizationResult
          }
        );

      } else {

        execution = await step(
          runId,
          7,
          "EXECUTION",
          () =>
            executionGateway.execute(
              assetId,
              {
                action: finalDecision.action,
                confidence:
                  Number(
                    finalDecision.confidence ??
                    finalDecision.reasoning?.confidence ??
                    100
                  ),
                approved: true,
                executionMode: "SIMULATED"
              }
            ),
          finalDecision
        );
      }

    } else {

      await store.addStep({
        runId,
        order: 6,
        name: "AUTHORIZATION",
        status: "SKIPPED",
        input: {
          action:
            finalDecision.action,
          autonomyMode
        },
        output: {
          status: "SKIPPED",
          reason:
            "ASSISTED mode requires human approval."
        }
      });


      await store.addStep({
        runId,
        order: 7,
        name: "EXECUTION",
        status: "SKIPPED",
        input: {
          action:
            finalDecision.action,
          autonomyMode
        },
        output: {
          status: "SKIPPED",
          reason:
            "Execution awaiting human approval.",
          action:
            finalDecision.action
        }
      });
    }


    await store.updateRun(runId, {
      execution_result:
        execution
    });


    const verification =
      await step(
        runId,
        8,
        "VERIFICATION",
        () =>
          verifier.verify({
            runId,
            action:
              finalDecision.action,
            autonomyMode,
            authorization:
              authorizationResult,
            expectedExecution:
              autonomyMode === "AUTONOMOUS"
                ? {
                    status: "SIMULATED",
                    action: finalDecision.action
                  }
                : null,
            actualExecution:
              execution
          }),
        {
          authorization:
            authorizationResult,
          execution,
          autonomyMode
        }
      );


    const learning =
      await step(
        runId,
        9,
        "LEARNING",
        () =>
          learn(
            runId,
            verification
          ),
        verification
      );


    await store.updateRun(runId, {
      status:
        verification.verified
          ? "COMPLETED"
          : "COMPLETED_WITH_WARNING",

      verification_result:
        verification,

      learning_result:
        learning,

      completed_at:
        new Date()
    });


    return await store.getRun(runId);

  } catch (error) {

    await store.updateRun(runId, {
      status: "FAILED",
      error: {
        message: error.message,
        stack: error.stack
      },
      completed_at: new Date()
    });

    throw error;
  }
}


module.exports = {
  run
};
