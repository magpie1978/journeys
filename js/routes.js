// =====================================================
// ROUTES.JS
// This file is the central controller for route data and route interaction. It:
//    Loads journeys from Supabase using the top-bar filters.
//    Converts those journeys into GeoJSON.
//    Displays the tracks on the Mapbox map.
//    Updates the sidebar, counters and airport markers.
//    Handles clicking and highlighting individual routes.
//    Coordinates route mode and countries mode.
// =====================================================


// =====================================================
// ROUTE STATE
// =====================================================

window.allRoutes =
  Array.isArray(window.allRoutes)
    ? window.allRoutes
    : [];

window.currentRoutes =
  Array.isArray(window.currentRoutes)
    ? window.currentRoutes
    : [];

window._routesHandlersBound =
  Boolean(window._routesHandlersBound);


/*
 * Preserve appState if another file has already created it.
 */
window.appState =
  window.appState || {};

if (!("mode" in window.appState)) {
  window.appState.mode = "routes";
}

if (!("isolatedUid" in window.appState)) {
  window.appState.isolatedUid = null;
}

if (!("activeAirport" in window.appState)) {
  window.appState.activeAirport = null;
}

if (!(window.appState.selectedUids instanceof Set)) {
  window.appState.selectedUids = new Set();
}

// =====================================================
// MAP IDS
// =====================================================

const ROUTES_SOURCE_ID =
  "routes";

// ADDED 17 AUG  2026 //
const ROUTES_GLOW_LAYER_ID =
  "routes-glow";
// END

const ROUTES_LINE_LAYER_ID =
  "routes-line";

const ROUTES_HIT_LAYER_ID =
  "routes-hit";


// =====================================================
// BASIC HELPERS
// =====================================================

function getJourneyType(route) {
  return String(
    route?.journey_type || ""
  ).toLowerCase();
}


function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: []
  };
}


function getCurrentMapMode() {
  return (
    window.appState?.mode ||
    "routes"
  );
}


function getCurrentIsolatedUid() {
  return (
    window.appState?.isolatedUid ||
    null
  );
}

function getCurrentSelectedUids() {
  if (
    window.appState?.selectedUids instanceof Set
  ) {
    return window.appState.selectedUids;
  }

  return new Set();
}

function findRouteByUid(uid) {
  if (uid == null) {
    return null;
  }

  const targetUid =
    String(uid);

  return (
    window.currentRoutes.find(
      route =>
        String(route?.uid) === targetUid
    ) ||

    window.allRoutes.find(
      route =>
        String(route?.uid) === targetUid
    ) ||

    null
  );
}


// =====================================================
// GEOJSON CONVERSION
// =====================================================

function routeToFeature(route) {
  /*
   * Keep geometry separate from properties.
   * The route geometry should not be duplicated inside
   * the GeoJSON properties object.
   */
  const {
    geom,
    ...properties
  } = route;

  return {
    type: "Feature",
    geometry: geom,
    properties
  };
}


function routesToFeatureCollection(routes) {
  return {
    type: "FeatureCollection",

    features: (routes || [])
      .filter(route => route?.geom)
      .map(routeToFeature)
  };
}


// =====================================================
// CREATE OR UPDATE ROUTE SOURCE
// =====================================================

function updateRoutesSource(routes) {
  const featureCollection =
    routesToFeatureCollection(routes);

  const existingSource =
    map.getSource(
      ROUTES_SOURCE_ID
    );

  if (existingSource) {
    existingSource.setData(
      featureCollection
    );

    return;
  }

  map.addSource(
    ROUTES_SOURCE_ID,
    {
      type: "geojson",
      data: featureCollection,
      tolerance: 0
    }
  );
}


// =====================================================
// CREATE ROUTE LAYERS
// =====================================================

function ensureRouteLayers() {
  if (
    !map.getSource(
      ROUTES_SOURCE_ID
    )
  ) {
    return;
  }


  // -------------------------------------------------
  // ROUTE GLOW - ADDED 17 AUGUST 2026
  // -------------------------------------------------
  
  if (
    !map.getLayer(
      ROUTES_GLOW_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        ROUTES_GLOW_LAYER_ID,
  
      type: "line",
  
      source:
        ROUTES_SOURCE_ID,
  
      paint: {
        "line-width": 8,
        "line-opacity": 0.18,
        "line-blur": 6,
  
        "line-color": [
          "case",
  
          [
            "==",
            ["get", "journey_type"],
            "Flight"
          ],
          "#CCFF00",
  
          [
            "==",
            ["get", "journey_type"],
            "Drive"
          ],
          "#1E90FF",
  
          "#E53935"
        ]
      }
    });
  }



  

  
  if (
    !map.getLayer(
      ROUTES_LINE_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        ROUTES_LINE_LAYER_ID,

      type: "line",

      source:
        ROUTES_SOURCE_ID,

      paint: {
        "line-width": 1.4,
        "line-opacity": 0.85,

        "line-color": [
          "case",

          [
            "==",
            ["get", "journey_type"],
            "Flight"
          ],
          "#CCFF00",  //was #FFD700

          [
            "==",
            ["get", "journey_type"],
            "Drive"
          ],
          "#1E90FF",

          "#E53935"
        ]
      }
    });
  }

  if (
    !map.getLayer(
      ROUTES_HIT_LAYER_ID
    )
  ) {
    map.addLayer({
      id:
        ROUTES_HIT_LAYER_ID,

      type: "line",

      source:
        ROUTES_SOURCE_ID,

      paint: {
        "line-width": 18,
        "line-opacity": 0
      }
    });
  }

  bindRouteHandlers();
}


// =====================================================
// CLEAR ROUTE DISPLAY
// =====================================================

function clearRouteDisplay({
  updateBaseRoutes = false
} = {}) {
  window.currentRoutes = [];

  if (updateBaseRoutes) {
    window.allRoutes = [];
  }

  /*
   * Keep compatibility with older code that accesses
   * currentRoutes as a standalone global variable.
   */
  if (
    typeof currentRoutes !==
    "undefined"
  ) {
    currentRoutes = [];
  }

  if (
    typeof updateAllCounters ===
    "function"
  ) {
    updateAllCounters([]);
  }

  if (
    typeof renderSidebar ===
    "function"
  ) {
    renderSidebar([]);
  }

  const source =
    map.getSource(
      ROUTES_SOURCE_ID
    );

  if (
    source &&
    typeof source.setData ===
      "function"
  ) {
    source.setData(
      emptyFeatureCollection()
    );
  }

  if (
    typeof loadAirports ===
    "function"
  ) {
    loadAirports([]);
  }

  if (
    typeof hideFlightSummary ===
    "function"
  ) {
    hideFlightSummary();
  }
}


// =====================================================
// RENDER ROUTES
// =====================================================

function renderRoutes(
  routes,
  {
    updateBaseRoutes = false,
    fitMap = true
  } = {}
) {
  const safeRoutes =
    Array.isArray(routes)
      ? routes.filter(
          route =>
            route &&
            route.geom
        )
      : [];

  if (!safeRoutes.length) {
    clearRouteDisplay({
      updateBaseRoutes
    });

    return;
  }

  /*
   * allRoutes is the complete collection returned by
   * the current top-bar filters.
   *
   * currentRoutes is the collection currently displayed.
   * It may be a smaller airport-filtered subset.
   */
  if (updateBaseRoutes) {
    window.allRoutes =
      safeRoutes.slice();
  }

  window.currentRoutes =
    safeRoutes.slice();

  /*
   * Compatibility with older files that still access
   * currentRoutes directly.
   */
  if (
    typeof currentRoutes !==
    "undefined"
  ) {
    currentRoutes =
      window.currentRoutes;
  }

  // -------------------------------------------------
  // UPDATE PAGE UI
  // -------------------------------------------------

  if (
    typeof updateAllCounters ===
    "function"
  ) {
    updateAllCounters(
      window.currentRoutes
    );
  }

  if (
    typeof renderSidebar ===
    "function"
  ) {
    renderSidebar(
      window.currentRoutes
    );
  }

  // -------------------------------------------------
  // UPDATE MAP DATA
  // -------------------------------------------------

  updateRoutesSource(
    window.currentRoutes
  );

  ensureRouteLayers();

  if (
    typeof loadAirports ===
    "function"
  ) {
    loadAirports(
      window.currentRoutes
    );
  }

  applyIsolationStyling();
  applyRouteModeVisibility();
  updateSidebarSelection();
  updateFlightSummaryFromState();

  // -------------------------------------------------
  // CAMERA FITTING
  // -------------------------------------------------

  if (
    fitMap &&
    getCurrentMapMode() ===
      "routes"
  ) {
    fitToCurrentRouteView();
  }
}

window.renderRoutes =
  renderRoutes;


// =====================================================
// LOAD ROUTES FROM SUPABASE
// =====================================================

async function loadRoutes() {
  if (
    typeof selected === "undefined" ||
    !(selected.years instanceof Set) ||
    selected.years.size === 0
  ) {
    console.warn(
      "[routes] Route load skipped because no year is selected"
    );

    clearRouteDisplay({
      updateBaseRoutes: true
    });

    return;
  }

  let query = sb
    .from("journeys_routes_2")
    .select(`
      uid,
      callsign,
      airline,
      journey_type,
      origin,
      destination,
      destination_country,
      cabin,
      journey_distance,
      journey_date,
      year,
      journey_duration_seconds,
      geom
    `);


  // -------------------------------------------------
  // YEAR FILTER
  // -------------------------------------------------

  const years =
    [...selected.years]
      .map(Number)
      .filter(Number.isFinite);

  if (!years.length) {
    console.warn(
      "[routes] No valid numeric years were selected"
    );

    clearRouteDisplay({
      updateBaseRoutes: true
    });

    return;
  }

  const yearClauses =
    years.map(year =>
      `and(` +
        `journey_date.gte.${year}-01-01,` +
        `journey_date.lt.${year + 1}-01-01` +
      `)`
    );

  query = query.or(
    yearClauses.join(",")
  );

  // -------------------------------------------------
  // AIRLINE FILTER
  // -------------------------------------------------

  if (
    selected.airlines?.size
  ) {
    query = query.in(
      "airline",
      [...selected.airlines]
    );
  }

  // -------------------------------------------------
  // JOURNEY-TYPE FILTER
  // -------------------------------------------------

  if (
    selected.types?.size
  ) {
    query = query.in(
      "journey_type",
      [...selected.types]
    );
  }

const {
  data,
  error
} = await query;

if (error) {
  console.error(
    "[routes] Route load failed:",
    error
  );

  clearRouteDisplay({
    updateBaseRoutes: true
  });

  return;
}


let routes =
  (data || [])
    .filter(route => route?.geom);

// -------------------------------------------------
// CABIN / CLASS FILTER
// Applies only to Flight journeys
// -------------------------------------------------

if (
  selected.cabins instanceof Set &&
  selected.cabins.size > 0
) {

  routes = routes.filter(route => {

    const journeyType =
      String(
        route?.journey_type || ""
      ).toLowerCase();

    // Cabin does not apply to Drive, Train,
    // Boat, Bus or Walk journeys.
    if (journeyType !== "flight") {
      return true;
    }

    return selected.cabins.has(
      route.cabin
    );
  });
}


  // -------------------------------------------------
  // AIRPORT DROPDOWN FILTER
  // -------------------------------------------------

  if (
    selected.airports?.size
  ) {
    /*
     * Expand selected city groups once, rather than
     * recalculating them once for every route.
     */
    const expandedAirportCodes =
      new Set(
        [...selected.airports]
          .flatMap(value => {
            const groupMembers =
              typeof AIRPORT_GROUPS !==
                "undefined"
                ? AIRPORT_GROUPS[value]
                : null;

            return Array.isArray(
              groupMembers
            )
              ? groupMembers
              : [value];
          })
      );

    routes = routes.filter(route => {
      /*
       * Airport filtering applies only to flights.
       * Non-flight journeys remain visible.
       */
      if (
        getJourneyType(route) !==
        "flight"
      ) {
        return true;
      }

      return (
        expandedAirportCodes.has(
          route.origin
        ) ||

        expandedAirportCodes.has(
          route.destination
        )
      );
    });
  }

  // -------------------------------------------------
  // NEWEST JOURNEY FIRST
  // -------------------------------------------------

  routes.sort((routeA, routeB) => {
    const dateA =
      new Date(
        routeA.journey_date
      ).getTime();

    const dateB =
      new Date(
        routeB.journey_date
      ).getTime();

    return dateB - dateA;
  });

// -------------------------------------------------
// PRESERVE ACTIVE AIRPORT ACROSS TOP-BAR FILTERS
// -------------------------------------------------

const activeAirport =
  window.appState?.activeAirport ||
  window.activeAirportFilter ||
  null;

/*
 * A top-bar filter change should clear a specific
 * journey selection, but it should NOT clear an
 * airport selection.
 */
window.appState.isolatedUid =
  null;


/*
 * The newly loaded routes are now the complete base
 * collection for the selected Year / Airline / Type /
 * Airport-dropdown / Class filters.
 */
window.allRoutes =
  routes.slice();


/*
 * If an airport is currently selected, update the
 * collection that airports.js should restore when the
 * airport is later deselected.
 */
if (
  activeAirport &&
  typeof window.updateAirportFilterBaseRoutes ===
    "function"
) {
  window.updateAirportFilterBaseRoutes(
    routes
  );
}


/*
 * Reapply the clicked-airport filter to the newly
 * loaded route collection.
 */


  if (activeAirport) {

  const airportRoutes =
    routes.filter(route =>
      getJourneyType(route) === "flight" &&
      (
        route.origin === activeAirport ||
        route.destination === activeAirport
      )
    );

  renderRoutes(
    airportRoutes,
    {
      updateBaseRoutes: false,
      fitMap: true
    }
  );


  // -------------------------------------------------
  // REFRESH AIRPORT SUMMARY BAR
  // -------------------------------------------------

  if (
    typeof window.showAirportSummary ===
      "function"
  ) {

    const airportNameEl =
      document.getElementById(
        "airportName"
      );

    window.showAirportSummary({
      code: activeAirport,

      city:
        airportNameEl
          ?.textContent
          ?.trim() || ""
    });
  }

} else {

    
  /*
   * No clicked airport is active, so display the
   * complete top-bar-filtered route collection.
   */
  renderRoutes(
    routes,
    {
      updateBaseRoutes: true,
      fitMap: true
    }
  );
}
  
window.loadRoutes =
  loadRoutes;
}

// =====================================================
// ROUTE EVENT HANDLERS
// =====================================================

function bindRouteHandlers() {
  if (
    window._routesHandlersBound
  ) {
    return;
  }

  window._routesHandlersBound =
    true;

  // -------------------------------------------------
  // ROUTE CLICK
  // -------------------------------------------------

  map.on(
    "click",
    ROUTES_HIT_LAYER_ID,
    event => {
      const uid =
        event.features?.[0]
          ?.properties?.uid;

      if (uid == null) {
        return;
      }

      setIsolatedRoute(uid);
    }
  );

  // -------------------------------------------------
  // CURSOR
  // -------------------------------------------------

  map.on(
    "mouseenter",
    ROUTES_HIT_LAYER_ID,
    () => {
      map.getCanvas()
        .style.cursor =
          "pointer";
    }
  );

  map.on(
    "mouseleave",
    ROUTES_HIT_LAYER_ID,
    () => {
      map.getCanvas()
        .style.cursor =
          "";
    }
  );

  // -------------------------------------------------
  // CLEAR ROUTE SELECTION ON EMPTY MAP CLICK
  // -------------------------------------------------

  map.on("click", event => {
    if (
      !getCurrentIsolatedUid() ||
      getCurrentMapMode() !==
        "routes"
    ) {
      return;
    }

    if (
      !map.getLayer(
        ROUTES_HIT_LAYER_ID
      )
    ) {
      return;
    }

    const routeHits =
      map.queryRenderedFeatures(
        event.point,
        {
          layers: [
            ROUTES_HIT_LAYER_ID
          ]
        }
      );

    if (!routeHits.length) {
      setIsolatedRoute(null);
    }
  });
}


// =====================================================
// ROUTE SELECTION
// =====================================================

function setIsolatedRoute(
  uid,
  additive = false
) {
  const selectedUids =
    getCurrentSelectedUids();

  const uidString =
    uid != null
      ? String(uid)
      : null;


  // -------------------------------------------------
  // CLEAR EVERYTHING
  // -------------------------------------------------

  if (uidString == null) {
    selectedUids.clear();

    window.appState.isolatedUid =
      null;
  }


  // -------------------------------------------------
  // CTRL / CMD CLICK
  // Add or remove this route from the selection.
  // -------------------------------------------------

  else if (additive) {

    if (selectedUids.has(uidString)) {
      selectedUids.delete(uidString);
    } else {
      selectedUids.add(uidString);
    }

    /*
     * isolatedUid remains useful for the existing
     * single-route summary behaviour.
     */
    window.appState.isolatedUid =
      selectedUids.size === 1
        ? [...selectedUids][0]
        : null;
  }


  // -------------------------------------------------
  // NORMAL CLICK
  // Preserve the existing single-selection behaviour.
  // -------------------------------------------------

  else {

    const alreadyOnlySelected =
      selectedUids.size === 1 &&
      selectedUids.has(uidString);

    selectedUids.clear();

    if (alreadyOnlySelected) {
      window.appState.isolatedUid =
        null;
    } else {
      selectedUids.add(uidString);

      window.appState.isolatedUid =
        uidString;
    }
  }


  // Selecting journeys cancels airport selection.
  window.appState.activeAirport =
    null;

  if (
    typeof window.activeAirportFilter !==
    "undefined"
  ) {
    window.activeAirportFilter =
      null;
  }


  if (
    selectedUids.size &&
    typeof hideAirportSummary ===
      "function"
  ) {
    hideAirportSummary();
  }


  applyIsolationStyling();
  updateSidebarSelection();
  updateFlightSummaryFromState();
  fitToCurrentRouteView();
}


window.setIsolatedRoute =
  setIsolatedRoute;


// =====================================================
// ACTIVE AIRPORT STATE
// =====================================================

function setActiveAirport(code) {
  const currentAirport =
    window.appState.activeAirport;

  window.appState.activeAirport =
    currentAirport === code
      ? null
      : code;

  window.appState.isolatedUid =
    null;

  /*
   * Airport marker filtering is primarily handled by
   * airports.js. This function remains available for
   * compatibility with other files.
   */
  if (
    typeof window.filterRoutesByAirport ===
      "function" &&
    code
  ) {
    window.filterRoutesByAirport(
      code
    );
  }
}

window.setActiveAirport =
  setActiveAirport;


// =====================================================
// MAP MODE
// =====================================================

function setMapMode(mode) {
  if (
    mode !== "routes" &&
    mode !== "countries"
  ) {
    console.warn(
      `[routes] Unsupported map mode: ${mode}`
    );

    return;
  }

  window.appState.mode =
    mode;

  /*
   * Compatibility with map.js versions that still use
   * the standalone mapMode variable.
   */
  if (
    typeof mapMode !==
    "undefined"
  ) {
    mapMode = mode;
  }

  /*
   * Use the central controller in map.js when available.
   */
  if (
    typeof applyMapMode ===
    "function"
  ) {
    applyMapMode();
  } else {
    applyRouteModeVisibility();

    if (
      mode === "routes"
    ) {
      fitToCurrentRouteView();
    }
  }
}

window.setMapMode =
  setMapMode;


// =====================================================
// ISOLATION STYLING - REPLACE ON 17 AUGUST 2026
// =====================================================

/*
function applyIsolationStyling() {
  if (
    !map.getLayer(
      ROUTES_LINE_LAYER_ID
    )
  ) {
    return;
  }

  const isolatedRouteUid =
    getCurrentIsolatedUid();

  if (!isolatedRouteUid) {
    map.setPaintProperty(
      ROUTES_LINE_LAYER_ID,
      "line-opacity",
      0.85
    );

    map.setPaintProperty(
      ROUTES_LINE_LAYER_ID,
      "line-width",
      1.4
    );

    return;
  }

  map.setPaintProperty(
    ROUTES_LINE_LAYER_ID,
    "line-opacity",
    [
      "case",

      [
        "==",
        ["to-string", ["get", "uid"]],
        String(isolatedRouteUid)
      ],

      1,
      0.15
    ]
  );

  map.setPaintProperty(
    ROUTES_LINE_LAYER_ID,
    "line-width",
    [
      "case",

      [
        "==",
        ["to-string", ["get", "uid"]],
        String(isolatedRouteUid)
      ],

      3,
      1.4
    ]
  );
}
*/


  function applyIsolationStyling() {
  
    if (
      !map.getLayer(
        ROUTES_LINE_LAYER_ID
      )
    ) {
      return;
    }
  
    const isolatedRouteUid =
      getCurrentIsolatedUid();
  
  
    // -------------------------------------------------
    // NO SELECTED JOURNEY
    // -------------------------------------------------
  
    if (!isolatedRouteUid) {
  
      map.setPaintProperty(
        ROUTES_LINE_LAYER_ID,
        "line-opacity",
        0.85
      );
  
      map.setPaintProperty(
        ROUTES_LINE_LAYER_ID,
        "line-width",
        1.4
      );
  
  
      if (
        map.getLayer(
          ROUTES_GLOW_LAYER_ID
        )
      ) {
        map.setPaintProperty(
          ROUTES_GLOW_LAYER_ID,
          "line-opacity",
          0.14
        );
  
        map.setPaintProperty(
          ROUTES_GLOW_LAYER_ID,
          "line-width",
          7
        );
  
        map.setPaintProperty(
          ROUTES_GLOW_LAYER_ID,
          "line-blur",
          6
        );
      }
  
      return;
    }
  
  
    // -------------------------------------------------
    // SELECTED JOURNEY — MAIN LINE
    // -------------------------------------------------
  
    map.setPaintProperty(
      ROUTES_LINE_LAYER_ID,
      "line-opacity",
      [
        "case",
  
        [
          "==",
          ["to-string", ["get", "uid"]],
          String(isolatedRouteUid)
        ],
  
        1,
        0.12
      ]
    );
  
    map.setPaintProperty(
      ROUTES_LINE_LAYER_ID,
      "line-width",
      [
        "case",
  
        [
          "==",
          ["to-string", ["get", "uid"]],
          String(isolatedRouteUid)
        ],
  
        2.8,
        1.2
      ]
    );
  
  
    // -------------------------------------------------
    // SELECTED JOURNEY — GLOW
    // -------------------------------------------------
  
    if (
      map.getLayer(
        ROUTES_GLOW_LAYER_ID
      )
    ) {
  
      map.setPaintProperty(
        ROUTES_GLOW_LAYER_ID,
        "line-opacity",
        [
          "case",
  
          [
            "==",
            ["to-string", ["get", "uid"]],
            String(isolatedRouteUid)
          ],
  
          0.55,
          0.03
        ]
      );
  
      map.setPaintProperty(
        ROUTES_GLOW_LAYER_ID,
        "line-width",
        [
          "case",
  
          [
            "==",
            ["to-string", ["get", "uid"]],
            String(isolatedRouteUid)
          ],
  
          12,
          5
        ]
      );
  
      map.setPaintProperty(
        ROUTES_GLOW_LAYER_ID,
        "line-blur",
        [
          "case",
  
          [
            "==",
            ["to-string", ["get", "uid"]],
            String(isolatedRouteUid)
          ],
  
          8,
          5
        ]
      );
    }
  }

window.applyIsolationStyling =
  applyIsolationStyling;


// =====================================================
// ROUTE-MODE LAYER VISIBILITY
// =====================================================

function applyRouteModeVisibility() {
  const routesVisible =
    getCurrentMapMode() ===
    "routes";

  const visibility =
    routesVisible
      ? "visible"
      : "none";

  [
    ROUTES_GLOW_LAYER_ID, // ADDED 17 AUGUST 2026
    ROUTES_LINE_LAYER_ID,
    ROUTES_HIT_LAYER_ID
  ].forEach(layerId => {
    if (
      map.getLayer(layerId)
    ) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visibility
      );
    }
  });
}


// =====================================================
// SIDEBAR SELECTION
// =====================================================

function updateSidebarSelection() {
  const selectedUid =
    getCurrentIsolatedUid();

  document
    .querySelectorAll(
      "#flightList li[data-uid]"
    )
    .forEach(item => {
      const isActive =
        selectedUid != null &&
        item.dataset.uid ===
          String(selectedUid);

      item.classList.toggle(
        "active",
        isActive
      );
    });
}


// =====================================================
// FLIGHT SUMMARY STATE
// =====================================================

function updateFlightSummaryFromState() {
  const isolatedRoute =
    findRouteByUid(
      getCurrentIsolatedUid()
    );

  if (
    isolatedRoute &&
    typeof showFlightSummary ===
      "function"
  ) {
    showFlightSummary(
      isolatedRoute
    );

    return;
  }

  if (
    typeof hideFlightSummary ===
      "function"
  ) {
    hideFlightSummary();
  }
}


// =====================================================
// FIT CURRENT ROUTE VIEW
// =====================================================

function fitToCurrentRouteView() {
  if (
    getCurrentMapMode() !==
      "routes" ||
    typeof fitToBoundsFromLineGeoms !==
      "function"
  ) {
    return;
  }

  const isolatedRoute =
    findRouteByUid(
      getCurrentIsolatedUid()
    );

  if (isolatedRoute?.geom) {
  
    const journeyType =
      String(
        isolatedRoute.journey_type || ""
      ).toLowerCase();
  
    /*
     * Walks are usually geographically small,
     * so fit them much more tightly.
     */
    if (journeyType === "walk") {
  
      const bounds =
        new mapboxgl.LngLatBounds();
  
      const addCoordinates =
        coordinates => {
  
          if (!Array.isArray(coordinates)) {
            return;
          }
  
          if (
            typeof coordinates[0] === "number" &&
            typeof coordinates[1] === "number"
          ) {
            bounds.extend(coordinates);
            return;
          }
  
          coordinates.forEach(
            addCoordinates
          );
        };
  
      addCoordinates(
        isolatedRoute.geom.coordinates
      );
  
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: {
            top: 70,
            bottom: 70,
            left:
              typeof getSidebarLeftPad ===
                "function"
                ? getSidebarLeftPad() + 30
                : 100,
            right: 70
          },
  
          duration: 650,
  
          /*
           * Allows short walks to zoom in
           * much closer than long journeys.
           */
          maxZoom: 16
        });
      }
  
      return;
    }
  
    /*
     * Normal behaviour for Flights, Trains,
     * Drives, Boats, Buses etc.
     */
    fitToBoundsFromLineGeoms([
      isolatedRoute.geom
    ]);
  
    return;
  }

  
  const geometries =
    window.currentRoutes
      .map(route => route?.geom)
      .filter(Boolean);

  if (geometries.length) {
    fitToBoundsFromLineGeoms(
      geometries
    );
  }
}

window.fitToCurrentRouteView =
  fitToCurrentRouteView;
