const SUPPORTED_SIMULATIONS = new Set([
  "BLOCK_TRADE",
  "FAST_MOVE",
  "DISCOUNT",
  "BOOST_DISCOVERY",
  "REQUIRE_REVIEW",
  "MONITOR"
]);

function validate(action) {
  if (typeof action !== "string" || !SUPPORTED_SIMULATIONS.has(action)) {
    return {
      allowed: false,
      reason: "Unsupported action blocked; no external effect was performed."
    };
  }

  return {
    allowed: true,
    reason: "Supported recommendation recorded for simulation only; no external effect was performed."
  };
}

module.exports = {
  validate,
  supportedSimulations: [...SUPPORTED_SIMULATIONS]
};
