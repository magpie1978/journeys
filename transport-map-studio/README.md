# Transport Map Studio v0.4.2 — track-aware editor (test build)

Deploy `index.html`, `styles.css`, `app.js`, and `geometry.js` together to `/transport-map-studio/`. Save your existing map as JSON before deploying.

## Changes
- Geometry handles and dashed centreline are hidden during ordinary editing. Select a corridor and click **Edit corridor geometry** to show them; click **Finish editing geometry** to hide them. Double-click a corridor to enter geometry editing.
- Corridor Properties includes **Track position: Automatic / Above existing / Below existing**.
- A new corridor at an occupied horizontal station reserves an entire contiguous bundle above or below the existing strands, taking strand count and spacing into account.
- Automatic route candidates are checked against the actual rounded SVG strands of existing corridors. A candidate crossing or interleaving existing strands is rejected, rather than drawn through them.
- Included `transport-map-project-lanes.json` is the previously corrected two-strand example for Town Hall.

## Important limitations
- The automatic router is still candidate-based and can refuse a connection even if a more complex collision-free path exists. Add manual bend points or reposition stations in that case.
- The above/below track allocation currently applies to occupied **horizontal** station corridors; complex junctions, multiple occupied sides and automatic merging remain future work.
- The imported old project may already contain overlaps; this build does not silently rewrite existing routes.
- The collision guard samples rounded SVG paths at approximately 4px intervals and is not a formal continuous-curve intersection proof.
- Changing a corridor's frequency may require revisiting its track position.

JavaScript syntax checked; interactive browser acceptance tests have not been completed.
