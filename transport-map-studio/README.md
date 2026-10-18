# Transport Map Studio v0.2.1 — geometry correction

Deploy `index.html`, `styles.css`, and `app.js` together to your existing GitHub Pages folder.

## Fixes
- Reworked fillet geometry so parallel strands have perpendicular offsets and concentric corner arcs.
- Replaced the broken Redfern sample topology: the six-strand route now continues through a diagonal-to-horizontal bend BEFORE Redfern, instead of terminating at Redfern and restarting as an unrelated three-strand route.
- Wynyard remains on a straight section before the bend.
- Existing saved projects are preserved and migrated to v0.2.1 storage.

## Important: see the corrected sample
If you have previously used v0.2, your browser will load your existing saved project rather than overwrite it. First export your current project with **Save JSON**, then click **Restore sample** to load the corrected example.

## Scope and limitation
This patch fixes the demonstration geometry. It does not yet implement automatic joining of separately drawn corridors, service branching or station-aware corner relocation for arbitrary imported projects. Very tight bends can still require manual adjustment.
