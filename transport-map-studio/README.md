# Transport Map Studio v0.3.1 — station labels and drawing guide

Deploy all five files in this ZIP together. This is a patch of v0.3; geometry.js is unchanged. The existing `transport-map-studio-v03` browser storage key is preserved, so your saved project should carry over. Export JSON before replacing files as a backup.

## Station labels

Select a station with **Select / move**, then in **Properties** choose **Station name position**: Above tracks, Below tracks, or Manual / drag label. Above is the default for old stations too. Both automatic modes clear the entire frequency bundle; on vertical corridors they place text to the left/right. Drag the yellow handle to switch to manual placement. Label rotation and font size remain adjustable.

## Build out Sydney — practical sequence

1. Save JSON first. Choose **Add station** and click an empty area of the grid. Select the new station and rename it in Properties. Repeat to create the desired stations.
2. Switch to **Draw corridor**. Click an existing station to start. Click empty grid locations to add intermediate routing points, then click a destination station to finish. Press Escape to cancel. The app rejects invalid geometry.
3. Select a completed corridor using **Select / move**. In Properties set **Trains per direction / hour** (strand count) and individual strand colours. For bends, select a corridor and drag its square handles; double-click to insert a new bend. Allowed straight angles are configured on the left; rounded turns are generated automatically.
4. Add station names and set Above or Below. Use the yellow label handle only for crowded locations; manual positioning can be refined with the numeric offsets.
5. Use **Fit map**, mouse-wheel zoom, and **Pan** or Space+drag. Export JSON frequently for editable backups and SVG for finished artwork.

### Important v0.3 limitation

A station added visually on an existing corridor is only a station marker. It is not a new route endpoint, and adding it does not automatically split a corridor. A new branch must be drawn between station endpoints as its own corridor. Automatic splitting, service merges and shared-strand routing are planned future capabilities. Avoid drawing overlapping independent corridors as a substitute for a true merged frequency bundle.

### Suggested Sydney construction order

First expand the central trunk (Central, Town Hall, Wynyard, Redfern, Green Square). Then add the southern airport corridor, the western corridor towards Strathfield, and the northern corridor. Work one branch at a time and check geometry before expanding further.

### Validation

JavaScript syntax is checked for this patch. Browser interaction has not been fully regression-tested; keep a JSON backup.
