#!/bin/bash

set -e

echo "Updating āprən Freshness Intelligence..."

mkdir -p src/intelligence
mkdir -p src/uploads

cat > src/intelligence/freshness.js <<'JS'
function analyzeFreshness(asset){

    const now = new Date();

    let expiryHours = 24;

    if(asset.category === "Prepared meals"){
        expiryHours = 24;
    }

    if(asset.category === "Produce"){
        expiryHours = 72;
    }

    if(asset.category === "Grains"){
        expiryHours = 720;
    }

    const score = Math.min(
        100,
        Math.max(
            0,
            asset.imageConfidence || 90
        )
    );

    const expiry = new Date(
        now.getTime() + expiryHours * 60 * 60 * 1000
    );

    return {
        score,
        estimatedExpiry: expiry.toISOString(),
        confidence: score
    };
}

module.exports = analyzeFreshness;
JS


python3 - <<'PY'
from pathlib import Path

p = Path("src/server.js")

s = p.read_text()

if 'require("./intelligence/freshness")' not in s:
    s = s.replace(
        'const cors = require("cors");',
        'const cors = require("cors");\nconst analyzeFreshness = require("./intelligence/freshness");'
    )

old = 'res.json(asset);'

new = '''const freshness = analyzeFreshness({
   category: asset.category,
   imageConfidence: asset.freshness
 });


 res.json({
   ...asset,
   freshness
 });'''

if old in s:
    s = s.replace(old,new)

p.write_text(s)

print("server.js updated")
PY


echo "Installing dependencies..."
npm install

echo ""
echo "Freshness Intelligence update complete."
echo ""
echo "Start service with:"
echo "npm start"
