# Transport Map Studio v0.2.3

Deploy `index.html`, `styles.css`, and `app.js` to your existing GitHub Pages folder.

## Geometry overhaul
- Straight segments constrained to selected bearings (45° increments by default).
- Rounded 45°, 90° and 135° direction changes permitted. 180° reversals rejected.
- One common fillet layout per corridor, offset by each strand's normal distance.
- Exact concentric circular arcs, with no sharp-corner fallback.
- Adjacent fillets shrink together when needed; too-tight bends display an error.
- Existing JSON and browser projects retained. Export JSON backup before updating.
- Click **Restore sample** to reload the sample geometry after deployment.

## Known limitations
- Corridors are independent; service merging/splitting and crossing logic are future work.
- Invalid loaded project geometry shows a warning instead of rendering invalid curves.
- The sample is a geometric demonstration, not a faithful Sydney network topology.
