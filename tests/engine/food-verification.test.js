import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const verification = require("../../services/apren-engine/src/verification/verify.js");

describe("Apren food verification claims", () => {
  it("records submitted evidence as review-required until a real verifier is configured", () => {
    const assetId = 900000001;
    const result = verification.verifyFood({
      id: assetId,
      type: "image",
      file: "evidence-ref:engine-test"
    });

    assert.equal(result.assetId, assetId);
    assert.equal(result.evidenceType, "image");
    assert.equal(result.file, "evidence-ref:engine-test");
    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.equal(result.verified, false);
    assert.equal(result.confidence, null);
    assert.match(result.reason, /no configured verifier/i);
    assert.deepEqual(verification.getVerification(assetId), [result]);
  });

  it("does not fabricate a verification or confidence when evidence is absent", () => {
    const result = verification.verifyFood({ id: 900000002 });

    assert.equal(result.status, "REVIEW_REQUIRED");
    assert.equal(result.verified, false);
    assert.equal(result.confidence, null);
    assert.equal(result.file, null);
    assert.match(result.reason, /no evidence reference/i);
  });

  it("rejects invalid asset identifiers", () => {
    assert.throws(() => verification.verifyFood({ id: "not-an-id" }), /valid positive asset id/i);
    assert.throws(() => verification.verifyFood({ id: 0 }), /valid positive asset id/i);
  });
});
