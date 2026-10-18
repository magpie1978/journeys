# Portugal Railway Atlas — v1.0

A static GitHub Pages railway map using Mapbox GL JS, OpenRailwayMap tiles, and viewport-specific OpenStreetMap railway ways through Overpass.

## Deploy

1. Extract the ZIP. Upload `index.html`, `css/`, and `js/` to the root of a GitHub repository.
2. In GitHub: Settings → Pages → Deploy from a branch → main / (root).
3. Open the resulting GitHub Pages URL. Enter a **public** Mapbox access token beginning `pk.` in the setup dialog. The token is stored in your browser's localStorage, not in GitHub.
4. Zoom to 10 or greater to inspect actual OSM individual track ways, including parallel tracks and sidings.

## Notes and limitations

- The overview uses OpenRailwayMap's standard raster tiles; it is not affected by detailed-track status filters. The detailed geometry is fetched separately from Overpass at zoom 10+ and is filterable.
- The overview can display railway classes beyond those selected in the sidebar, including metro/tram depending on OpenRailwayMap rendering.
- OpenStreetMap does not contain a complete historical reconstruction. Only mapped disused/abandoned/razed alignments can appear.
- At high zoom, the app queries the visible bounding box (clipped to mainland Portugal), not the whole country. The geometry is individual OSM ways, not a guaranteed rail-by-rail engineering inventory.
- Overpass is a shared third-party service: large viewports may be slow or temporarily rate-limited. If it fails, zoom in and click Refresh detail.
- The app covers mainland Portugal in the detailed query. Islands are not included in the v1 bounding box.
- Nominatim is used only for manually submitted station/place searches. Search and data services require internet connectivity.
- For large-scale production traffic, replace public Overpass with a hosted Portugal OSM extract / vector tiles and a proper geocoder.
- Mapbox requires a public token; configure URL restrictions on the token in your Mapbox account.

## Credits

© OpenStreetMap contributors (ODbL). OpenRailwayMap railway tile rendering. Mapbox basemap. Preserve the on-map attribution when modifying this app.

## v1.1 troubleshooting
Deploy index.html and both css/ and js/ folders inside the same portugal/ directory.
Check https://YOUR-DOMAIN/portugal/css/style.css returns CSS (not 404).
Overpass queries use GET with multiple public endpoint fallbacks; all remain subject to public service CORS, capacity and availability.


## v1.2 status filter fix
The OpenRailwayMap raster overview cannot be filtered. It now hides when detailed OSM tracks are available and enabled, or when any status checkbox is unchecked. When the Overpass service fails, the UI explicitly states that filtered detail is unavailable. At low zoom, filters require zooming in to level 10 or higher.
