# Transport Map Studio v0.2.2 — strict schematic geometry

Deploy `index.html`, `styles.css`, and `app.js` together.

## Changes
- Corrected sample: Wynyard turns horizontal → southeast; Redfern turns southeast → horizontal, with no vertical intermediate segment.
- Parallel strands use shared centreline tangent points and offset concentric arcs.
- Segment bearings must be multiples of 45° (or 30° in that mode); a single corner may change heading by at most 45° (30° in that mode). Horizontal and vertical straight sections remain allowed.
- Invalid station and bend drags are blocked; invalid route completion and bend insertion are rejected.
- Existing browser projects remain available; click **Restore sample** to see the corrected demo. Export JSON before replacing or restoring anything.

## Known limitations
- No automatic re-routing when moving a station: the edit is rejected if it breaks the angle rules.
- Very short segments may require a larger radius or manual repositioning; the renderer scales down the centreline fillet to fit, which can be visually tight.
- Existing imported or saved invalid routes are not silently rewritten.
- Multi-route merging and junctions are not yet supported.
