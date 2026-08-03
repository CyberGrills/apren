const feedback =
require("./feedbackEngine");

const performance =
require("./performanceEngine");

const adaptation =
require("./adaptationEngine");


module.exports={

recordFeedback:
feedback.record,

history:
feedback.history,

performance:
performance.evaluate,

adapt:
adaptation.adapt

};
