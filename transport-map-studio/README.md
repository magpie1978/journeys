# Transport Map Studio v0.4 — easy connections

Deploy all four files to `/transport-map-studio/` on GitHub Pages.

## New workflow
1. Save JSON to back up your existing project.
2. Select **Add station**, click the map, then use **Select / move** to rename it.
3. Select **Connect stations**, click the first station name or bar, then the destination station name or bar.
4. The editor tests direct and multiple elbow routes using the existing concentric circular geometry engine, choosing the shortest valid candidate.
5. Select the resulting corridor. Set **Line colour (all strands)** and **Trains per direction / hour** in Properties.
6. Save JSON. Use Export SVG for an image.

## Notes
- You may still click intermediate empty grid positions to specify bends manually.
- Existing v0.3 local storage is reused, so previously saved maps remain available.
- The automatic router is a candidate-based first version, not an obstacle-avoiding or globally optimal network router.
- A corridor can connect to a station already on another corridor. It does not automatically split or merge service paths.
- If no candidate can satisfy the configured grid angles, bend radius and segment lengths, an error is shown.
- Preserve all four files: index.html, styles.css, app.js, geometry.js.
- Browser automation was unavailable in this environment. JavaScript syntax was checked; please visually test the new interaction before relying on it for a large map.
