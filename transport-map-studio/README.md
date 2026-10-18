# Transport Map Studio — Multi-Bend Geometry Lab v0.2

Open `index.html` in Chrome. No server or dependencies needed.

Try S-bends, consecutive same-direction bends, 90° reversals, mixed-angle sequences, and intentionally short segments. Adjust incoming heading, strand count, spacing, radius and leg length. Export SVG from the browser.

Automated verification: `node tests.js`. The test suite covers 112 single-turn orientations, 64 multi-bend orientations, 80 frequency/spacing/angle stress cases and 3 deliberate invalid configurations (259 checks).

Geometry implementation: circular fillets share tangent points along the original centreline, with concentric signed normal offsets. Invalid inner radii, too-short legs and 180° reversals are rejected. No radius is silently adjusted.

Limitations: This is an isolated geometric laboratory, not yet the production editor. It does not detect self-intersections between non-adjacent route portions, does not support automatic branch merging, and does not construct hairpin loops. Browser visual validation remains a separate acceptance step.

## v0.2.1 bug fix
Fixed browser namespace mismatch: geometry.js now exposes window.Geometry to the interface while retaining Node exports. Browser-rendered default S-bend (12 SVG strands) and same-direction bend confirmed; tight invalid geometry rejected.
