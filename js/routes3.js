// =====================================================
// ROUTES.JS — CLEAN STATE-DRIVEN VERSION
// =====================================================

// Optional stable base set for airport filtering
window.allRoutes = window.allRoutes || [];
window._routesHandlersBound = window._routesHandlersBound || false;


// =====================================================
// GLOBAL APP STATE
// =====================================================

window.appState = {
  mode: "routes",         // "routes" | "countries"
  isolatedUid: null,      // currently isolated route
  activeAirport: null     // selected airport
};


// =====================================================
// RENDER ROUTES
// =====================================================

function renderRoutes(routes, { resetIsolation = true } = {}) {

  const safeRoutes = (routes || []).filter(r => r && r.geom);

  if (!safeRoutes.length) {
    currentRoutes = [];
    window.allRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);

    if (typeof clearSource === "function") {
      clearSource("routes");
      clearSource("airports");
    }
    return;
  }

  currentRoutes = safeRoutes.slice();
  window.allRoutes = currentRoutes.slice();

  // ---------------- UI ----------------
  updateAllCounters(currentRoutes);
  renderSidebar(currentRoutes);

  // ---------------- GEOJSON ----------------
  const fc = {
    type: "FeatureCollection",
    features: currentRoutes.map(r => ({
      type: "Feature",
      geometry: r.geom,
      properties: r
    }))
  };

  if (map.getLayer("routes-hit")) map.removeLayer("routes-hit");
  if (map.getLayer("routes-line")) map.removeLayer("routes-line");
  if (map.getSource("routes")) map.removeSource("routes");

  map.addSource("routes", {
    type: "geojson",
    data: fc,
    tolerance: 0.05
  });

  map.addLayer({
    id: "routes-line",
    type: "line",
    source: "routes",
    paint: {
      "line-width": 1.4,
      "line-opacity": 0.85,
      "line-color": [
        "case",
        ["==", ["get", "journey_type"], "Flight"], "#FFD700",
        ["==", ["get", "journey_type"], "Drive"], "#1E90FF",
        "#E53935"
      ]
    }
  });

  map.addLayer({
    id: "routes-hit",
    type: "line",
    source: "routes",
    paint: {
      "line-width": 18,
      "line-opacity": 0
    }
  });

  bindRouteHandlers();

  if (typeof loadAirports === "function") {
    loadAirports(currentRoutes);
  }

  applyIsolationStyling();
  applyMapModeFromState();

  if (appState.mode === "routes") {
    fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
  }
}

window.renderRoutes = renderRoutes;


// =====================================================
// LOAD ROUTES
// =====================================================

async function loadRoutes() {

  if (!selected?.years || selected.years.size === 0) {
    console.warn("[routes] loadRoutes aborted – no year selected yet");
    return;
  }

  let q = sb
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

  const years = [...selected.years].map(Number);

  const yearClauses = years.map(y =>
    `and(journey_date.gte.${y}-01-01,journey_date.lt.${y+1}-01-01)`
  );

  q = q.or(yearClauses.join(","));

  if (selected.airlines.size) {
    q = q.in("airline", [...selected.airlines]);
  }

  if (selected.types.size) {
    q = q.in("journey_type", [...selected.types]);
  }

  const { data, error } = await q;

  if (error) {
    console.error("[routes] load failed:", error);
    currentRoutes = [];
    window.allRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);
    return;
  }

  let routes = (data || []).filter(r => r && r.geom);
  
  // =====================================================
  // AIRPORT FILTER (FROM DROPDOWN)
  // =====================================================
  
  if (selected.airports && selected.airports.size) {
  
    routes = routes.filter(r => {
  
      if (r.journey_type !== "Flight") return true;
  
      const selectedAirports = [...selected.airports];
  
      const expanded = selectedAirports.flatMap(code => {
        if (AIRPORT_GROUPS?.[code]) {
          return AIRPORT_GROUPS[code];
        }
        return code;
      });
  
      return (
        expanded.includes(r.origin) ||
        expanded.includes(r.destination)
      );
  
    });
  }
    routes = routes.sort(
      (a, b) => new Date(b.journey_date) - new Date(a.journey_date)
    );
  
    renderRoutes(routes);
  }


// =====================================================
// ROUTE HANDLERS
// =====================================================

function bindRouteHandlers() {

  if (window._routesHandlersBound) return;
  window._routesHandlersBound = true;

  map.on("click", "routes-hit", e => {
    const uid = e.features?.[0]?.properties?.uid;
    if (uid) setIsolatedRoute(uid);
  });

  map.on("mouseenter", "routes-hit", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "routes-hit", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("click", e => {
    if (!appState.isolatedUid || appState.mode !== "routes") return;

    const hits = map.queryRenderedFeatures(e.point, {
      layers: ["routes-hit"]
    });

    if (!hits.length) {
      setIsolatedRoute(null);
    }
  });
}


// =====================================================
// STATE CONTROLLER
// =====================================================

function setIsolatedRoute(uid) {

  if (appState.isolatedUid === uid) {
    appState.isolatedUid = null;
  } else {
    appState.isolatedUid = uid;
  }

  appState.activeAirport = null;
  updateUIFromState();
}

function setActiveAirport(code) {

  if (appState.activeAirport === code) {
    appState.activeAirport = null;
  } else {
    appState.activeAirport = code;
  }

  appState.isolatedUid = null;
  updateUIFromState();
}

function setMapMode(mode) {
  appState.mode = mode;
  updateUIFromState();
}


// =====================================================
// MASTER UI UPDATE
// =====================================================

function updateUIFromState() {

  let routes = currentRoutes.slice();

  if (appState.activeAirport) {
    routes = routes.filter(r =>
      r.journey_type === "Flight" &&
      (r.origin === appState.activeAirport ||
       r.destination === appState.activeAirport)
    );
  }

  renderRoutes(routes, { resetIsolation: false });
}


// =====================================================
// ISOLATION STYLING
// =====================================================

function applyIsolationStyling() {

  if (!map.getLayer("routes-line")) return;

  if (!appState.isolatedUid) {
    map.setPaintProperty("routes-line", "line-opacity", 0.85);
    map.setPaintProperty("routes-line", "line-width", 1.4);
    return;
  }

  map.setPaintProperty("routes-line", "line-opacity", [
    "case",
    ["==", ["get", "uid"], appState.isolatedUid],
    1,
    0.15
  ]);

  map.setPaintProperty("routes-line", "line-width", [
    "case",
    ["==", ["get", "uid"], appState.isolatedUid],
    3,
    1.4
  ]);
}


// =====================================================
// MAP MODE
// =====================================================

function applyMapModeFromState() {

  if (appState.mode === "countries") {

    if (map.getLayer("routes-line"))
      map.setLayoutProperty("routes-line", "visibility", "none");

    setCountriesFilterFromRoutes(currentRoutes);

    if (map.getLayer("countries-fill"))
      map.setLayoutProperty("countries-fill", "visibility", "visible");

  } else {

    if (map.getLayer("countries-fill"))
      map.setLayoutProperty("countries-fill", "visibility", "none");

    if (map.getLayer("routes-line"))
      map.setLayoutProperty("routes-line", "visibility", "visible");
  }
}
