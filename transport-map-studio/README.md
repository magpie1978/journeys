# Transport Map Studio v0.4.1 — track lanes (preview)

This release includes your corrected project as `transport-map-project-lanes.json`. Load it using **Load JSON** after deploying the four website files. Save your existing project first.

At Town Hall, the six original tracks stay at y=120,128,136,144,152,160. The two new strands occupy y=168,176. The new route approaches from the south-east with a 45-degree diagonal, rounded into a westbound horizontal segment.

New connections to stations already occupied by a horizontal corridor are assigned a separate lane below the bundle. This is a first implementation, not yet a universal collision solver. The router may still fail or cross other tracks elsewhere, and multi-corridor station bar sizes are provisional.

The old local-storage project remains unchanged; this version uses a separate v0.4.1 storage key. You can always reload your saved JSON.
