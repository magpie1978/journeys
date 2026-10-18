# Transport Map Studio v0.1

A static, browser-based schematic transport map editor. No build process, API key or backend is required.

## Deployment
Upload `index.html`, `styles.css` and `app.js` together into a GitHub Pages directory. Open `index.html` on the published site.

## Controls
- Select: drag stations, select a corridor, drag its square bend handles.
- Add station: click an empty grid location, then rename the station in Properties.
- Draw corridor: click a starting station, click optional bend positions, then click the ending station. Escape cancels.
- Add bend point: click an existing corridor; or double-click a corridor in any mode.
- Pan: drag the canvas, or hold Space while dragging.
- Mouse wheel: zoom at the pointer.
- Delete: delete selected station or corridor.
- Undo/Redo: toolbar or Cmd/Ctrl+Z (Shift for redo).
- Save JSON / Load JSON: portable project format.
- Export SVG: exports the current viewport.

## Geometry
Parallel strands are offset perpendicular to a shared centreline. Filleted bends use strand-specific concentric circular arcs. The bend radius is increased to prevent the innermost strand from collapsing. Tight segments may reduce radii to fit. The geometry engine is a first iteration; acute junctions, self-crossing paths, and automatic merging/reordering of service strands are not yet supported.

## Known limitations / next steps
- Route segments are independent; automatic junction routing and service-frequency aggregation are not implemented.
- Angle snapping applies while placing corridor bends; dragging existing bends is grid-snapped only.
- The example uses illustrative station placement and frequencies, not verified Sydney timetable data.
- Export SVG is viewport-based; future versions should offer page bounds and print layouts.
- Browser localStorage is convenience storage, not a replacement for exported JSON backups.
