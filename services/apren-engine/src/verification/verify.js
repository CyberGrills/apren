const records = [];

function verifyFood(asset) {
  const assetId = Number(asset && asset.id);
  if (!Number.isSafeInteger(assetId) || assetId <= 0) {
    throw new TypeError("A valid positive asset id is required.");
  }

  const evidenceType =
    typeof asset.type === "string" && asset.type.trim()
      ? asset.type.trim()
      : null;
  const file =
    typeof asset.file === "string" && asset.file.trim()
      ? asset.file.trim()
      : null;

  const verification = {
    id: records.length + 1,
    assetId,
    evidenceType,
    file,
    confidence: null,
    status: "REVIEW_REQUIRED",
    verified: false,
    reason: file
      ? "Evidence was recorded, but no configured verifier can authenticate it automatically."
      : "No evidence reference was supplied; automatic verification was not performed.",
    createdAt: new Date().toISOString()
  };

  records.push(verification);
  return verification;
}

function getVerification(assetId) {
  const normalizedId = Number(assetId);
  if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
    return [];
  }

  return records.filter((record) => record.assetId === normalizedId);
}

module.exports = {
  verifyFood,
  getVerification
};
