# Transport Map Studio v0.2

Static schematic transport map editor. Upload `index.html`, `styles.css`, and `app.js` to the same GitHub Pages folder. No build step.

## New in v0.2
- Station tick markers span the width of the largest associated corridor.
- Interchange stations use a thick white bar (select station → Properties → Interchange marker).
- Station label X/Y offsets, rotation, size and alignment. Drag the yellow handle when a station is selected.
- Route midpoint handles (blue) insert draggable bend points; square handles move existing bends.
- Fit map toolbar button.
- Autosave storage migrated from v0.1 when no v0.2 save exists.

## Editing
Select station → drag to move; click a route to select it. Draw corridor: click first station, add bend points, click last station. Double-click route to insert bend. Scroll to zoom, Space+drag to pan, Escape to cancel. Save JSON to keep portable backups.

## Known limitations
- Station ticks use the widest associated corridor and do not yet create full multi-service interchange symbols.
- Shared-corridor strand routing, junction splitting/merging, label collision detection and segment dragging without inserting a bend are future features.
- Very tight compound bends can still produce imperfect offset geometry.
- v0.1 local projects migrate to v0.2; existing v0.1 data is not deleted.
