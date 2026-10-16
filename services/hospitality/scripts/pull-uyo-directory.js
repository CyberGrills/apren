const fs = require("node:fs");
const path = require("node:path");

const ROOT = "https://hotels.ng/hotels-in-akwaibom/uyo";
const OUTPUT = path.join(__dirname, "../data/uyo-hotel-directory.json");
const USER_AGENT = "AprenHospitalityDirectoryResearch/1.0 (public directory indexing; polite sequential requests)";
const DELAY_MS = 700;

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractListings(html, pageUrl) {
  const starts = [...html.matchAll(/<div\s+itemscope\s+itemtype="http:\/\/schema\.org\/Hotel"\s+class="listing-hotels">/gi)].map(m => m.index);
  const records = [];
  for (let i = 0; i < starts.length; i += 1) {
    const block = html.slice(starts[i], starts[i + 1] ?? html.length);
    const nameMatch = block.match(/<h2[^>]*class="listing-hotels-name"[^>]*>([\s\S]*?)<\/h2>/i);
    const linkMatch = block.match(/<a\s+href="([^"]+)"[^>]*>\s*<h2[^>]*class="listing-hotels-name"/i);
    const addressMatch = block.match(/<p\s+itemprop="address"[^>]*>([\s\S]*?)<\/p>/i);
    if (!nameMatch || !linkMatch) continue;
    const name = decodeHtml(nameMatch[1]);
    const address = decodeHtml(addressMatch?.[1] || "");
    const detailUrl = new URL(linkMatch[1], pageUrl).toString();
    const normalizedName = name.toLocaleLowerCase("en-NG").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    if (!name || !normalizedName) continue;
    records.push({
      name,
      normalized_name: normalizedName,
      address: address || null,
      property_type_guess: /apartment|shortlet|serviced/i.test(name) ? "serviced_apartment_or_shortlet" : /guest house|guesthouse|motel|lodge/i.test(name) ? "guest_house_or_lodge" : "hotel_or_accommodation",
      detail_url: detailUrl,
      source_url: pageUrl,
      source_name: "Hotels.ng public Uyo accommodation directory",
      captured_at: new Date().toISOString(),
      status: "unverified_lead",
      notes: "Directory candidate only. Verify operation, partner consent, exact location, direct contact, current rates, room inventory and availability before publication. No rate or availability is inferred from this record."
    });
  }
  return records;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Directory returned HTTP ${response.status} for ${url}`);
  return response.text();
}

async function main() {
  const byKey = new Map();
  let pagesFetched = 0;
  let emptyPages = 0;
  const maxPages = 50;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = `${ROOT}/${page}`;
    const html = await fetchPage(url);
    pagesFetched += 1;
    const records = extractListings(html, url);
    let added = 0;
    for (const record of records) {
      const existing = byKey.get(record.normalized_name);
      if (!existing) {
        byKey.set(record.normalized_name, record);
        added += 1;
      } else {
        const sources = new Set([existing.source_url, record.source_url]);
        existing.source_urls = [...sources];
        if (!existing.address && record.address) existing.address = record.address;
      }
    }
    console.log(`Page ${page}: ${records.length} records, ${added} new unique names`);
    if (records.length === 0) {
      emptyPages += 1;
      break;
    }
    if (page > 1 && added === 0) {
      emptyPages += 1;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  const directoryRecords = [...byKey.values()].map(record => ({
    ...record,
    source_urls: record.source_urls || [record.source_url]
  })).sort((a, b) => a.name.localeCompare(b.name));
  const output = {
    dataset: "Uyo public accommodation discovery leads",
    source: ROOT,
    captured_at: new Date().toISOString(),
    pages_fetched: pagesFetched,
    unique_lead_count: directoryRecords.length,
    status: "unverified_leads_only",
    publication_rule: "Never publish these records as verified properties or bookable inventory without partner verification and review.",
    records: directoryRecords
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${directoryRecords.length} unique unverified leads from ${pagesFetched} directory pages to ${OUTPUT}`);
  if (directoryRecords.length < 100) throw new Error(`Expected a broad directory pull; only ${directoryRecords.length} unique records were collected. Review the source response before using this dataset.`);
}

main().catch(error => {
  console.error("Uyo directory pull failed:", error.message);
  process.exitCode = 1;
});
