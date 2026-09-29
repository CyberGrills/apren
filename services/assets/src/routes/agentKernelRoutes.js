const express = require("express");

const router = express.Router();

const agent =
  require("../agent/agentKernel");


router.post(
  "/agent/run",
  async (req, res) => {

    try {

      const result =
        await agent.run({
          assetId:
            req.body.assetId,

          goal:
            req.body.goal,

          data:
            req.body.data || req.body,

          autonomyMode:
            req.body.autonomyMode ||
            "ASSISTED"
        });

      res.json(result);

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


router.get(
  "/agent/run/:runId",
  async (req, res) => {

    try {

      const store =
        require("../agent/agentRunStore");

      const result =
        await store.getRun(
          req.params.runId
        );

      if (!result) {
        return res.status(404).json({
          error: "Agent run not found"
        });
      }

      res.json(result);

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


module.exports = router;
