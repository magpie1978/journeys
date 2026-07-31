// =====================================================
// ROUTES3.JS
// Efficient state-driven route rendering
// =====================================================


// =====================================================
// GLOBAL ROUTE STATE
// =====================================================

window.allRoutes = window.allRoutes || [];
window.currentRoutes = window.currentRoutes || [];

window._routesHandlersBound =
  window._routesHandlersBound || false;


// Preserve an existing appState if another script created it
window.appState = window.appState || {
  mode: "routes",
  isolatedUid: null,
  activeAirport: null
};


// Ensure all expected properties exist
if (!("mode" in window.appState)) {
  window.appState.mode = "routes";
}

if (!("isolatedUid" in window.appState)) {
  window.appState.isolatedUid = null;
}

if (!("activeAirport" in window.appState)) {
  window.appState.activeAirport = null;
}


// =====================================================
// CONSTANTS
// =====================================================

const ROUTES_SOURCE_ID = "routes";
const ROUTES_LINE_LAYER_ID = "routes-line";
const ROUTES_HIT_LAYER_ID = "routes-hit";


// =====================================================
// GEOJSON HELPERS
// =====================================================

function routeToFeature(route) {
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
// CREATE OR UPDATE MAP SOURCE
// =====================================================

function updateRoutesSource(routes) {
  if (!map) return;

  const featureCollection =
    routesToFeatureCollection(routes);

  const existingSource =
    map.getSource(ROUTES_SOURCE_ID);

  // Update the existing source rather than rebuilding it
  if (existingSource) {
    existingSource.setData(featureCollection);
    return;
  }

  map.addSource(ROUTES_SOURCE_ID, {
    type: "geojson",
    data: featureCollection,
    tolerance: 0
  });
}


// =====================================================
// CREATE ROUTE LAYERS
// =====================================================

function ensureRouteLayers() {
  if (!map || !map.getSource(ROUTES_SOURCE_ID)) {
    return;
  }

  if (!map.getLayer(ROUTES_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_LINE_LAYER_ID,
      type: "line",
      source: ROUTES_SOURCE_ID,

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
          "#FFD700",

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

  if (!map.getLayer(ROUTES_HIT_LAYER_ID)) {
    map.addLayer({
      id: ROUTES_HIT_LAYER_ID,
      type: "line",
      source: ROUTES_SOURCE_ID,

      paint: {
        "line-width": 18,
        "line-opacity": 0
      }
    });
  }

  bindRouteHandlers();
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
  const safeRoutes = (routes || [])
    .filter(route => route?.geom);

  /*
   * allRoutes:
   * Full route set returned by the current top-bar filters.
   *
   * currentRoutes:
   * Routes currently visible on the map. This may be a
   * subset when an airport is active.
   */
  if (updateBaseRoutes) {
    window.allRoutes = safeRoutes.slice();
  }

  window.currentRoutes = safeRoutes.slice();

  // Update interface elements that genuinely depend
  // on the currently visible route collection
  updateAllCounters(window.currentRoutes);
  renderSidebar(window.currentRoutes);

  updateRoutesSource(window.currentRoutes);
  ensureRouteLayers();

  if (typeof loadAirports === "function") {
    loadAirports(window.currentRoutes);
  }

  applyIsolationStyling();
  applyMapModeFromState();
  updateSidebarSelection();
  updateFlightSummaryFromState();

  if (fitMap && appState.mode === "routes") {
    fitToCurrentRouteView();
  }
}

window.renderRoutes = renderRoutes;


// =====================================================
// LOAD ROUTES FROM SUPABASE
// =====================================================

async function loadRoutes() {
  if (
    !selected?.years ||
    selected.years.size === 0
  ) {
    console.warn(
      "[routes] loadRoutes aborted – no year selected"
    );

    renderRoutes([], {
      updateBaseRoutes: true
    });

    return;
  }

  let query = sb
    .from("journeys_routes")
    .select(`
      uid,
      callsign,
      airline,
      journey_type,
      origin,
      destination,
      destination_country,
      journey_distance,
      journey_date,
      year,
      journey_duration_seconds,
      geom
    `);

  // -------------------------------------------------
  // YEAR FILTER
  // -------------------------------------------------

  const years = [...selected.years]
    .map(Number)
    .filter(Number.isFinite);

  const yearClauses = years.map(year =>
    `and(` +
      `journey_date.gte.${year}-01-01,` +
      `journey_date.lt.${year + 1}-01-01` +
    `)`
  );

  if (yearClauses.length) {
    query = query.or(yearClauses.join(","));
  }

  // -------------------------------------------------
  // AIRLINE FILTER
  // -------------------------------------------------

  if (selected.airlines?.size) {
    query = query.in(
      "airline",
      [...selected.airlines]
    );
  }

  // -------------------------------------------------
  // JOURNEY TYPE FILTER
  // -------------------------------------------------

  if (selected.types?.size) {
    query = query.in(
      "journey_type",
      [...selected.types]
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[routes] load failed:",
      error
    );

    window.allRoutes = [];
    window.currentRoutes = [];

    updateAllCounters([]);
    renderSidebar([]);

    if (
      map &&
      map.getSource(ROUTES_SOURCE_ID)
    ) {
      map
        .getSource(ROUTES_SOURCE_ID)
        .setData(routesToFeatureCollection([]));
    }

    return;
  }

  let routes = (data || [])
    .filter(route => route?.geom);

  // -------------------------------------------------
  // AIRPORT FILTER
  // -------------------------------------------------

  if (selected.airports?.size) {
    const selectedAirportValues =
      [...selected.airports];

    /*
     * AIRPORT_GROUPS should ideally be defined once
     * in a shared config file loaded before routes3.js
     * and filters3.js.
     */
    const groups =
      typeof AIRPORT_GROUPS !== "undefined"
        ? AIRPORT_GROUPS
        : {};

    const expandedAirportSet = new Set(
      selectedAirportValues.flatMap(value => {
        const groupMembers = groups[value];

        return Array.isArray(groupMembers)
          ? groupMembers
          : [value];
      })
    );

    routes = routes.filter(route => {
      /*
       * Preserve non-flight journeys when an airport
       * filter is active, matching the previous behaviour.
       */
      if (route.journey_type !== "Flight") {
        return true;
      }

      return (
        expandedAirportSet.has(route.origin) ||
        expandedAirportSet.has(route.destination)
      );
    });
  }

  // -------------------------------------------------
  // SORT NEWEST FIRST
  // -------------------------------------------------

  routes.sort((a, b) => {
    const dateA =
      new Date(a.journey_date).getTime();

    const dateB =
      new Date(b.journey_date).getTime();

    return dateB - dateA;
  });

  /*
   * A new database/filter load becomes the new
   * permanent base route collection.
   */
  appState.activeAirport = null;
  appState.isolatedUid = null;

  renderRoutes(routes, {
    updateBaseRoutes: true,
    fitMap: true
  });
}


// =====================================================
// ROUTE EVENT HANDLERS
// =====================================================

function bindRouteHandlers() {
  if (
    window._routesHandlersBound ||
    !map
  ) {
    return;
  }

  window._routesHandlersBound = true;

  // -------------------------------------------------
  // CLICK A ROUTE
  // -------------------------------------------------

  map.on(
    "click",
    ROUTES_HIT_LAYER_ID,
    event => {
      const uid =
        event.features?.[0]?.properties?.uid;

      if (!uid) return;

      /*
       * Prevent the general map click handler from
       * immediately clearing the selection.
       */
      if (
        event.originalEvent &&
        typeof event.originalEvent.stopPropagation ===
          "function"
      ) {
        event.originalEvent.stopPropagation();
      }

      setIsolatedRoute(uid);
    }
  );

  // -------------------------------------------------
  // POINTER CURSOR
  // -------------------------------------------------

  map.on(
    "mouseenter",
    ROUTES_HIT_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "pointer";
    }
  );

  map.on(
    "mouseleave",
    ROUTES_HIT_LAYER_ID,
    () => {
      map.getCanvas().style.cursor = "";
    }
  );

  // -------------------------------------------------
  // CLICK EMPTY MAP AREA
  // -------------------------------------------------

  map.on("click", event => {
    if (
      !appState.isolatedUid ||
      appState.mode !== "routes"
    ) {
      return;
    }

    if (!map.getLayer(ROUTES_HIT_LAYER_ID)) {
      return;
    }

    const routeHits =
      map.queryRenderedFeatures(
        event.point,
        {
          layers: [ROUTES_HIT_LAYER_ID]
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

function setIsolatedRoute(uid) {
  const nextUid =
    appState.isolatedUid === uid
      ? null
      : uid;

  appState.isolatedUid = nextUid;
  appState.activeAirport = null;

  /*
   * Route selection does not change route data.
   * Therefore, do not call renderRoutes().
   */
  applyIsolationStyling();
  updateSidebarSelection();
  updateFlightSummaryFromState();
  fitToCurrentRouteView();
}

window.setIsolatedRoute = setIsolatedRoute;


// =====================================================
// ACTIVE AIRPORT
// =====================================================

function setActiveAirport(code) {
  appState.activeAirport =
    appState.activeAirport === code
      ? null
      : code;

  appState.isolatedUid = null;

  /*
   * Airport selection genuinely changes which routes
   * are visible, so derive a subset from allRoutes.
   */
  updateVisibleRoutesFromState();
}

window.setActiveAirport = setActiveAirport;


// =====================================================
// MAP MODE
// =====================================================

function setMapMode(mode) {
  if (
    mode !== "routes" &&
    mode !== "countries"
  ) {
    console.warn(
      `[routes] Invalid map mode: ${mode}`
    );

    return;
  }

  appState.mode = mode;

  applyMapModeFromState();

  if (mode === "routes") {
    applyIsolationStyling();
    fitToCurrentRouteView();
  } else if (
    typeof fitToVisibleCountries === "function"
  ) {
    fitToVisibleCountries();
  }
}

window.setMapMode = setMapMode;


// =====================================================
// DERIVE VISIBLE ROUTES FROM STATE
// =====================================================

function getVisibleRoutesFromState() {
  let routes = window.allRoutes.slice();

  if (appState.activeAirport) {
    routes = routes.filter(route =>
      route.journey_type === "Flight" &&
      (
        route.origin ===
          appState.activeAirport ||

        route.destination ===
          appState.activeAirport
      )
    );
  }

  return routes;
}


function updateVisibleRoutesFromState() {
  const visibleRoutes =
    getVisibleRoutesFromState();

  renderRoutes(visibleRoutes, {
    updateBaseRoutes: false,
    fitMap: true
  });
}


// Keep this function for compatibility with any other
// existing files that may still call it.
function updateUIFromState() {
  updateVisibleRoutesFromState();
}

window.updateUIFromState = updateUIFromState;


// =====================================================
// ISOLATION STYLING
// =====================================================

function applyIsolationStyling() {
  if (
    !map ||
    !map.getLayer(ROUTES_LINE_LAYER_ID)
  ) {
    return;
  }

  if (!appState.isolatedUid) {
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
        ["get", "uid"],
        appState.isolatedUid
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
        ["get", "uid"],
        appState.isolatedUid
      ],

      3,
      1.4
    ]
  );
}

window.applyIsolationStyling =
  applyIsolationStyling;


// =====================================================
// SIDEBAR SELECTION STATE
// =====================================================

function updateSidebarSelection() {
  const sidebarItems =
    document.querySelectorAll(
      "#flight-list li[data-uid], " +
      ".flight-list li[data-uid], " +
      ".sidebar li[data-uid]"
    );

  sidebarItems.forEach(item => {
    const isActive =
      Boolean(appState.isolatedUid) &&
      item.dataset.uid ===
        String(appState.isolatedUid);

    item.classList.toggle(
      "active",
      isActive
    );
  });
}


// =====================================================
// FLIGHT SUMMARY
// =====================================================

function getIsolatedRoute() {
  if (!appState.isolatedUid) {
    return null;
  }

  return (
    window.currentRoutes.find(
      route =>
        String(route.uid) ===
        String(appState.isolatedUid)
    ) ||

    window.allRoutes.find(
      route =>
        String(route.uid) ===
        String(appState.isolatedUid)
    ) ||

    null
  );
}


function updateFlightSummaryFromState() {
  const isolatedRoute =
    getIsolatedRoute();

  if (
    isolatedRoute &&
    typeof showFlightSummary === "function"
  ) {
    showFlightSummary(isolatedRoute);
    return;
  }

  if (typeof hideFlightSummary === "function") {
    hideFlightSummary();
  }
}


// =====================================================
// FIT MAP TO CURRENT ROUTE VIEW
// =====================================================

function fitToCurrentRouteView() {
  if (
    !map ||
    appState.mode !== "routes" ||
    typeof fitToBoundsFromLineGeoms !==
      "function"
  ) {
    return;
  }

  const isolatedRoute =
    getIsolatedRoute();

  if (isolatedRoute?.geom) {
    /*
     * All routes remain rendered, but the camera fits
     * only the selected route.
     */
    fitToBoundsFromLineGeoms([
      isolatedRoute.geom
    ]);

    return;
  }

  const visibleGeometries =
    window.currentRoutes
      .map(route => route.geom)
      .filter(Boolean);

  if (visibleGeometries.length) {
    fitToBoundsFromLineGeoms(
      visibleGeometries
    );
  }
}


// =====================================================
// MAP MODE VISIBILITY
// =====================================================

function applyMapModeFromState() {
  if (!map) return;

  if (appState.mode === "countries") {
    if (map.getLayer(ROUTES_LINE_LAYER_ID)) {
      map.setLayoutProperty(
        ROUTES_LINE_LAYER_ID,
        "visibility",
        "none"
      );
    }

    if (map.getLayer(ROUTES_HIT_LAYER_ID)) {
      map.setLayoutProperty(
        ROUTES_HIT_LAYER_ID,
        "visibility",
        "none"
      );
    }

    if (
      typeof setCountriesFilterFromRoutes ===
      "function"
    ) {
      setCountriesFilterFromRoutes(
        window.currentRoutes
      );
    }

    if (map.getLayer("countries-fill")) {
      map.setLayoutProperty(
        "countries-fill",
        "visibility",
        "visible"
      );
    }

    return;
  }

  // Routes mode
  if (map.getLayer("countries-fill")) {
    map.setLayoutProperty(
      "countries-fill",
      "visibility",
      "none"
    );
  }

  if (map.getLayer(ROUTES_LINE_LAYER_ID)) {
    map.setLayoutProperty(
      ROUTES_LINE_LAYER_ID,
      "visibility",
      "visible"
    );
  }

  if (map.getLayer(ROUTES_HIT_LAYER_ID)) {
    map.setLayoutProperty(
      ROUTES_HIT_LAYER_ID,
      "visibility",
      "visible"
    );
  }
}

window.applyMapModeFromState =
  applyMapModeFromState;
