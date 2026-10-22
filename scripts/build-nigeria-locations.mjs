import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nigeriaStates,
  normalizeNigeriaLocation,
} from '../packages/contracts/src/nigeriaLocations.ts';

// Run with Node 24+ and unzip. Pass a saved NG.zip to reproduce a captured source snapshot.
const sourceUrl = 'https://download.geonames.org/export/dump/NG.zip';
const output = fileURLToPath(new URL('../apps/web/public/data/nigeria/', import.meta.url));
const source = process.argv[2];
const downloadedAt = new Date().toISOString();
const temporary = await mkdtemp(join(tmpdir(), '7even-nigeria-'));
try {
  let archive;
  let sourceModifiedAt = null;
  if (source) archive = await readFile(source);
  else {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`GeoNames download failed: ${response.status}`);
    sourceModifiedAt = response.headers.get('last-modified');
    archive = Buffer.from(await response.arrayBuffer());
  }
  const archivePath = join(temporary, 'NG.zip');
  await writeFile(archivePath, archive);
  const text = execFileSync('unzip', ['-p', archivePath, 'NG.txt'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const sourceReadme = execFileSync('unzip', ['-p', archivePath, 'readme.txt'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  const licenseUrl = sourceReadme.match(
    /https?:\/\/creativecommons\.org\/licenses\/by\/[\d.]+\//,
  )?.[0];
  assert.ok(licenseUrl, 'The source must provide a Creative Commons Attribution license.');
  const rows = text
    .trimEnd()
    .split('\n')
    .map((line) => line.split('\t'));
  assert.ok(
    rows.every((row) => row.length === 19),
    'Unexpected GeoNames TSV format.',
  );
  const stateCodes = new Set(nigeriaStates.map((state) => state.code));
  const sourceStates = rows.filter((row) => row[6] === 'A' && row[7] === 'ADM1');
  assert.deepEqual(new Set(sourceStates.map((row) => row[10])), stateCodes);
  const includedFeatures = new Set([
    'PPL',
    'PPLA',
    'PPLA2',
    'PPLA3',
    'PPLA4',
    'PPLA5',
    'PPLC',
    'PPLF',
    'PPLG',
    'PPLL',
    'PPLR',
    'PPLS',
    'PPLX',
  ]);
  const populated = rows.filter((row) => row[6] === 'P');
  const current = populated.filter((row) => includedFeatures.has(row[7]));
  const includedPopulated = current.filter((row) => stateCodes.has(row[10]));
  // GeoNames classifies this important hospitality district as an island, not a populated place.
  const additionalAreas = rows.filter(
    (row) => row[0] === '2566582' && row[6] === 'T' && row[7] === 'ISL' && stateCodes.has(row[10]),
  );
  assert.equal(additionalAreas.length, 1, 'The source-backed Victoria Island area is missing.');
  const included = [...includedPopulated, ...additionalAreas];
  assert.ok(included.length > 60_000, 'Unexpectedly low Nigeria settlement coverage.');
  assert.equal(new Set(included.map((row) => row[0])).size, included.length);
  const areas = rows.filter((row) => row[6] === 'A' && row[7] === 'ADM2');
  const counts = {};
  let bytes = 0;
  await mkdir(output, { recursive: true });
  for (const state of nigeriaStates) {
    const places = included
      .filter((row) => row[10] === state.code)
      .map((row) => {
        const id = Number(row[0]);
        const population = Number(row[14]);
        assert.ok(Number.isSafeInteger(id) && id > 0 && row[1].trim());
        assert.ok(Number.isSafeInteger(population) && population >= 0);
        const aliases = [...new Set([row[2], ...row[3].split(',')])]
          .filter((alias) => alias && /^[\x20-\x7e]+$/.test(alias) && alias !== row[1])
          .filter((alias) => normalizeNigeriaLocation(alias))
          .join('|');
        return [id, row[1], row[11], population, aliases];
      })
      .sort((a, b) => a[1].localeCompare(b[1], 'en') || b[3] - a[3] || a[0] - b[0]);
    assert.ok(places.length > 0, `${state.name} has no settlements.`);
    const stateAreas = Object.fromEntries(
      areas.filter((row) => row[10] === state.code).map((row) => [row[11], row[1]]),
    );
    const json = `${JSON.stringify({ stateCode: state.code, areas: stateAreas, places })}\n`;
    await writeFile(join(output, `${state.slug}.json`), json);
    counts[state.slug] = places.length;
    bytes += Buffer.byteLength(json);
  }
  const provenance = {
    source: 'GeoNames Nigeria geographical database',
    sourceUrl,
    documentationUrl: 'https://download.geonames.org/export/dump/readme.txt',
    featureCodesUrl: 'https://www.geonames.org/export/codes.html',
    licenseUrl,
    attribution: 'Contains information from GeoNames, licensed under Creative Commons Attribution.',
    downloadedAt,
    sourceModifiedAt,
    archiveSha256: createHash('sha256').update(archive).digest('hex'),
    archiveBytes: archive.length,
    sourceFeatures: rows.length,
    sourcePopulatedPlaces: populated.length,
    includedFeatures: [...includedFeatures],
    excludedNonSettlementFeatures: populated.length - current.length,
    excludedUnresolvedStates: current.length - includedPopulated.length,
    additionalSourceAreas: additionalAreas.map((row) => ({
      id: row[0],
      name: row[1],
      featureClass: row[6],
      featureCode: row[7],
      stateCode: row[10],
    })),
    includedPopulatedPlaces: includedPopulated.length,
    includedLocations: included.length,
    statesAndFct: nigeriaStates.length,
    stateCounts: counts,
    dataBytes: bytes,
    transformation:
      'Current populated settlements and neighborhood areas with known admin1, including PPLX sections of populated places; additionally, source ID 2566582 Victoria Island (T/ISL) is retained as a source-backed hospitality area. No abandoned, destroyed or historical places. Primary labels preserved; ASCII alternate names retained. Source ADM2 labels retained as areas, without claiming official LGA coverage.',
    limitations:
      'GeoNames is a maintained geographical gazetteer, not a guarantee of every Nigerian village, neighborhood or current administrative boundary. Duplicate names refer to distinct source records; city selectors deduplicate names within a state. Some records lack area metadata and most have no population value.',
  };
  await writeFile(join(output, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  await writeFile(
    join(output, 'SOURCE_README.txt'),
    `${sourceReadme.replace(/[ \t]+$/gm, '').trimEnd()}\n`,
  );
  console.log(
    JSON.stringify({
      includedLocations: included.length,
      statesAndFct: 37,
      bytes,
      excludedUnresolvedStates: provenance.excludedUnresolvedStates,
    }),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
