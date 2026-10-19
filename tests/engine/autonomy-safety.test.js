import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const guard = require("../../services/apren-engine/src/autonomy/executionGuard.js");

describe("Apren action simulation guard", () => {
  it("allows only the recommendation actions produced by the current action engine", () => {
    assert.deepEqual(guard.supportedSimulations, [
      "BLOCK_TRADE",
      "FAST_MOVE",
      "DISCOUNT",
      "BOOST_DISCOVERY",
      "REQUIRE_REVIEW",
      "MONITOR"
    ]);

    for (const action of guard.supportedSimulations) {
      const result = guard.validate(action);
      assert.equal(result.allowed, true, action);
      assert.match(result.reason, /simulation only/i);
      assert.match(result.reason, /no external effect/i);
    }
  });

  it("fails closed for unknown, external, and malformed actions", () => {
    for (const action of [
      "DELETE",
      "REMOVE_USER",
      "SELL_NOW",
      "PROMOTE",
      "TRADE",
      "EXECUTE_SQL",
      "",
      null,
      undefined,
      { action: "MONITOR" }
    ]) {
      const result = guard.validate(action);
      assert.equal(result.allowed, false, String(action));
      assert.match(result.reason, /blocked/i);
    }
  });
});
