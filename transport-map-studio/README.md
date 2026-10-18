# Transport Map Studio — Universal Bend Geometry Tester

Open `index.html` in Chrome. No server or dependencies required.

Controls: incoming heading, turn angle (30, 45, 60, 90, 120, 135, 150 degrees), clockwise/anticlockwise, strand spacing, centreline radius and strand count. Export SVG.

The engine uses exact circular arcs tangent to both straight sections. Each strand uses radius `R - sign * offset` and a common centreline tangent distance `R * tan(turn / 2)`, so concentric arcs remain tangent and uniformly spaced. The test reports invalid inner radii and checks tangent continuity, arc centres and strand spacing.

This is a standalone geometry tester, not a replacement for the main editor. Junctions and service splitting are not included.
