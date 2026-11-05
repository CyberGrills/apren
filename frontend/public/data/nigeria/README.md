# Nigeria settlement catalog

Contains information from [GeoNames](https://www.geonames.org/), under the Creative Commons Attribution license identified in [SOURCE_README.txt](SOURCE_README.txt) and [provenance.json](provenance.json). The downloaded source snapshot, date, SHA-256, transformations and counts are recorded in provenance.json. No endorsement by GeoNames is implied.

This catalog supports destination discovery across Nigeria's 36 states and FCT. It includes current cities, towns, villages and other populated settlements, plus neighborhood and district sections (PPLX), from GeoNames with a known state. It also explicitly includes Victoria Island, source ID 2566582 in Lagos: GeoNames classifies it as an island (T/ISL), and it is retained as an important hospitality area. This is a documented single-area exception; other non-populated landforms are excluded. It excludes abandoned, destroyed and historical places, and records without a resolved state. It does not guarantee every village, neighborhood or the accuracy of administrative boundaries. Administrative areas are source ADM2 labels, not a claim of an exact official LGA list.

Each state file contains `stateCode`, an `areas` lookup, and compact `places` rows:

```text
[GeoNames ID, primary name, source area code, population or 0, ASCII aliases separated by |]
```

Primary names retain their original spelling and diacritics. Population is a ranking hint, and zero means that the source did not supply a population. Duplicate names are retained with distinct source IDs; UI city choices deduplicate a name within a state because marketplace city filters use text. No coordinates are shipped or inferred. Source identity can be inspected at `https://www.geonames.org/<ID>`.

The browser loads only a selected state's file. The server can load and cache the same files to search nationwide, avoiding a second large client index or an external geocoding request for each keystroke. The shared module `packages/contracts/src/nigeriaLocations.ts` supplies state names, paths, decoding, deduplication and search.

To refresh explicitly, run `node scripts/build-nigeria-locations.mjs` with Node 24+, network access and the system `unzip` utility. Pass a saved `NG.zip` as the first argument to rebuild from that snapshot. Regeneration changes the recorded download time; source IDs and transformed data are deterministic for the same source and runtime. Review source counts, exclusions, licensing and tests after updating.
