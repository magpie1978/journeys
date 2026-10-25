# Swedish Railway Diagram Editor v0.1

Static, browser-based schematic railway editor inspired by the supplied 2022 Swedish day-train diagram.

## Deploy on GitHub Pages

1. Extract this ZIP into a GitHub repository (keep `index.html`, `styles.css`, `app.js`, and `assets/` together).
2. In GitHub, open **Settings → Pages**, select **Deploy from a branch**, choose your main branch and `/ (root)`.
3. Open the published URL. No build step, API key or server is required.

## Features

- Original 2022 image as an adjustable-opacity reference underlay.
- Editable **starter sample** of Swedish stations and connections, not a full transcription of every station on the reference.
- Drag stations and station labels; draw connections; add and drag track bends; edit names and colours; delete objects.
- Grid snapping, zoom and pan, undo/redo, browser autosave.
- Portable project JSON export/import and standalone vector SVG export.
- SVG export intentionally exports the editable schematic, **not** the raster reference image.

## Controls

- **Select / move**: click or drag a station, station label or bend handle.
- **Add station**: enter a name and click the canvas.
- **Connect stations**: click a starting station, then a destination station.
- **Add track bend**: click a track, or double-click a track with any tool.
- **Pan**: use Pan tool, or hold Space while dragging.
- **Zoom**: mouse wheel or toolbar buttons.
- **Undo**: Ctrl+Z or Cmd+Z; **Redo**: Ctrl/Cmd+Shift+Z.
- **Delete**: Delete key or Delete selected button.

## Known limitations

The provided screenshot is a flattened image, so the original diagram's complete topology cannot be extracted reliably without manual tracing and validation. The initial editable starter dataset has approximately 40 major stations and illustrative connections; station coordinates are manually approximated to the screenshot, and connections are schematic rather than an authoritative 2022 service database. The underlying reference is never edited. New connections default to a single 45°-style corner; bends can be adjusted manually. No collaborative editing, geographic GIS import, service-frequency editing or automated collision avoidance in v0.1.

Projects are autosaved only in the current browser's local storage; export JSON regularly.
