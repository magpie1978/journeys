# Airlines Manager Rotation Optimiser v1.0

## What changed

- Automatic hub discovery from `data/routes.csv` and `data/pricing.csv`. No BOM/MPM whitelist.
- One hub per optimisation; each hub's route/demand data remains separate.
- Existing 168-hour seven-aircraft groups, economy/cargo configurations, coin exclusions and BKK/CGK/DEL destination exclusions retained.
- Session-only, first-confirmed global X380Plus group reservation retained (10 owned; only one full seven-aircraft group).
- Reusable **standard-library Python** CSV validation and hub replacement/merge utility: `tools/hub_data.py`.
- JSON validation report with per-hub owned route, pricing and usable pricing counts.

## Deploy to GitHub Pages

Copy `index.html`, `js/app.js`, `js/engine.js`, `js/worker.js`, `data/routes.csv`, `data/pricing.csv` to the corresponding paths in your existing site. Keep existing `css/style.css` and `data/aircraft.csv`. The tools directory is for local use, **not required on the website**.

## Step 1: Obtain hub data

The new hub's `routes.csv` must use **exactly** the column headers of the existing combined `data/routes.csv` (19 columns). Its `pricing.csv` must use **exactly** the combined `data/pricing.csv` headers (17 columns). Exports can use any column order; the utility writes them in the original order. These are game-derived exports, not generated from a destination catalogue alone.

For **new hubs**, a planning catalogue may list unowned destinations. You must purchase routes and collect their game route IDs and current pricing/demand before the optimiser can produce useful rotations. A hub with zero owned routes can be staged with `--allow-empty-owned`, but will not appear as an optimisable hub until it has both route and pricing data.

For **affiliated-to-active hubs**, export the *current complete snapshot* of routes (including previously purchased routes) and pricing. The merge replaces the selected hub's old records, rather than appending to them. A partial snapshot would remove omitted routes from the combined output; use a complete export.

The utility **does not fetch data from the game or Supabase**; continue using the established scanner/pricing exporter and any necessary schema conversion.

## Step 2: Validate existing files

Run from this package's directory:

```bash
python3 tools/hub_data.py validate \
  --routes data/routes.csv \
  --pricing data/pricing.csv \
  --report validation_report.json
```

Non-`ok` pricing records are warnings; duplicate route IDs, mismatched destination codes, malformed numbers, missing required columns and orphaned pricing are errors.

## Step 3A: Merge a completely new hub (example SYD)

```bash
python3 tools/hub_data.py merge \
  --scenario new --hub SYD \
  --base-routes data/routes.csv --base-pricing data/pricing.csv \
  --hub-routes imports/SYD_routes.csv \
  --hub-pricing imports/SYD_pricing.csv \
  --out-dir merged
```

If it has no purchased routes yet, use `--allow-empty-owned` to stage the catalogue. If it has purchased routes but no pricing yet, use `--allow-missing-pricing` to stage incomplete data. Neither situation produces usable rotations until successful pricing is present.

## Step 3B: Promote an affiliated hub to active (example BKK)

```bash
python3 tools/hub_data.py merge \
  --scenario promoted --hub BKK \
  --base-routes data/routes.csv --base-pricing data/pricing.csv \
  --hub-routes imports/BKK_routes.csv \
  --hub-pricing imports/BKK_pricing.csv \
  --out-dir merged
```

This **replaces** BKK rows in both combined CSVs with the full current BKK snapshot, if any. Other hubs remain untouched. `BKK`, `CGK`, `DEL` remain excluded as **destinations**, even when one is selected as an **origin hub**. If you want routes to those destinations to become eligible, that is a separate network-rule change.

## Step 4: Review before deploying

Inspect `merged/validation_report.json` and compare counts to game exports. Confirm owned routes, pricing status, route ID/destination alignment and hub selection. The utility writes new CSVs in `merged/` and does not overwrite existing source files. After checking, copy `merged/routes.csv` and `merged/pricing.csv` to `data/`, deploy, and hard-refresh the browser.

## Limits / precautions

- The optimiser remains greedy, not a globally optimal multi-hub allocation solver.
- Its revenue is an estimate; validate against Airlines Manager.
- X380Plus reservations are only in the current browser tab, reset on refresh, and do not synchronize across devices or with the game.
- A hub must occur in both combined datasets to be discoverable. The hub selector may include a hub with only failed pricing; it will have no usable priced routes. The diagnostics report makes this visible.
- CSV merge is fail-closed on structural errors and rejects mixing other hub codes into a single-hub import.
- New-hub source acquisition and mapping from Supabase/game exports into the 19/17-column schemas is still an upstream step; this release validates and merges *already standardised* exports.
