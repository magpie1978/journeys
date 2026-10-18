# Transport Map Studio v0.3

Deploy index.html, styles.css, geometry.js, app.js together to GitHub Pages.

This version uses the same Geometry.build / Geometry.verify concentric fillet engine as the tested multi-bend lab. New localStorage key v03; previous projects are not overwritten. Export JSON from the old editor, then Load JSON here if needed. Restore sample to see a single six-strand Central → Green Square corridor via 45-degree turns; Town Hall, Wynyard and Redfern are intermediate station ticks.

Important limitations: frequency changes, merging and splitting services, stations on curved sections, nonlocal self-intersection detection, automatic rerouting and 180-degree hairpins are not implemented. Invalid imported routes are drawn as dashed red centrelines. Some editing actions may be blocked when they would invalidate geometry. The geometry lab tests concentric fillets but not every browser editing interaction.
