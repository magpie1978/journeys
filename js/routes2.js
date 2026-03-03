// =====================================================
// ROUTES.JS (FINAL + AIRPORT FILTER ADDED)
// =====================================================

// Optional stable base set for airport filtering
window.allRoutes = window.allRoutes || [];

// Bind handlers once
window._routesHandlersBound =
  window._routesHandlersBound || false;



// =====================================================
// RENDER ROUTES
// =====================================================
function renderRoutes(
  routes,
  { resetIsolation = true } = {}
) {

  const safeRoutes =
    (routes || []).filter(r => r && r.geom);

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

  if (resetIsolation) {
    isolatedUid = null;
    lastRoutesBounds = null;
  }

  currentRoutes = safeRoutes.slice();
  window.allRoutes = currentRoutes.slice();



  // ---------------- UI ----------------
  updateAllCounters(currentRoutes);

  if (
    airlinesPanel?.classList.contains("visible") &&
    typeof renderAirlinesPanel === "function"
  ) {
    renderAirlinesPanel(currentRoutes);
  }

  renderSidebar(currentRoutes);



  // ---------------- GEOJSON ----------------
  const fc = {
    type: "FeatureCollection",
    features: currentRoutes.map(r => ({
      type: "Feature",
      geometry: r.geom,
      properties: r,
    })),
  };



  // ---------------- MAP RESET ----------------
  if (map.getLayer("routes-hit"))
    map.removeLayer("routes-hit");

  if (map.getLayer("routes-line"))
    map.removeLayer("routes-line");

  if (map.getSource("routes"))
    map.removeSource("routes");



  map.addSource("routes", {
    type: "geojson",
    data: fc,
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
        "#E53935",
      ],
    },
  });



  map.addLayer({
    id: "routes-hit",
    type: "line",
    source: "routes",
    paint: {
      "line-width": 18,
      "line-opacity": 0,
    },
  });



  // Bind handlers once
  if (!window._routesHandlersBound) {

    window._routesHandlersBound = true;

    map.on("click", "routes-hit", e => {
      const uid =
        e.features?.[0]?.properties?.uid;

      if (uid) toggleIsolation(uid);
    });

    map.on("mouseenter", "routes-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "routes-hit", () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("click", e => {
      if (!isolatedUid || mapMode !== "routes")
        return;

      const hits =
        map.queryRenderedFeatures(e.point, {
          layers: ["routes-hit"],
        });

      if (!hits.length)
        clearIsolation();
    });
  }



  // Airports
  if (typeof loadAirports === "function") {
    loadAirports(currentRoutes);
  }



  // Fit map
  if (mapMode === "routes") {
    fitToBoundsFromLineGeoms(
      currentRoutes.map(r => r.geom)
    );
  } else {
    applyMapMode();
  }
}

window.renderRoutes = renderRoutes;



// =====================================================
// LOAD ROUTES
// =====================================================
async function loadRoutes() {

  if (
    !selected?.years ||
    selected.years.size === 0
  ) {
    console.warn(
      "[routes] loadRoutes aborted – no year selected yet"
    );
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



  // ---------------- YEAR FILTER ----------------
  const years =
    [...selected.years].map(Number);

  const yearClauses = years.map(y =>
    `and(journey_date.gte.${y}-01-01,journey_date.lt.${y+1}-01-01)`
  );

  q = q.or(yearClauses.join(","));



  // ---------------- AIRLINE FILTER ----------------
  if (selected.airlines.size) {
    q = q.in(
      "airline",
      [...selected.airlines]
    );
  }



  // ---------------- TYPE FILTER ----------------
  if (selected.types.size) {
    q = q.in(
      "journey_type",
      [...selected.types].map(
        t => t?.value ?? t
      )
    );
  }



  // ---------------- FETCH ----------------
  const { data, error } = await q;

  if (error) {

    console.error(
      "[routes] load failed:",
      error
    );

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



  // =====================================================
  // BASE ROUTES SET
  // =====================================================
  let routes =
    (data || []).filter(r => r && r.geom);



  // =====================================================
  // AIRPORT FILTER (NEW)
  // =====================================================
  if (selected.airports.size) {

  routes = routes.filter(r => {

    if (r.journey_type !== "Flight")
      return true;

      const selectedAirports = [...selected.airports];
  
      // Expand airport groups
      const expanded = selectedAirports.flatMap(code => {
        if (AIRPORT_GROUPS[code]) {
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


  // =====================================================
// ROUTE ISOLATION SYSTEM
// =====================================================

  function toggleIsolation(uid) {
  
    if (!uid) return;
  
    // Clicking same route clears isolation
    if (isolatedUid === uid) {
      clearIsolation();
      return;
    }
  
    isolatedUid = uid;
  
    applyIsolation();
    renderSidebar(currentRoutes);
  
    if (mapMode === "routes") {
      const route = currentRoutes.find(r => r.uid === uid);
      if (route?.geom) {
        fitToBoundsFromLineGeoms([route.geom]);
      }
    }
  }

  function clearIsolation() {
    isolatedUid = null;
  
    applyIsolation();
    renderSidebar(currentRoutes);
  
    if (mapMode === "routes") {
      fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
    }
  }
  
  function applyIsolation() {
  
    if (!map.getLayer("routes-line")) return;
  
    map.setPaintProperty("routes-line", "line-opacity", [
      "case",
      ["==", ["get", "uid"], isolatedUid],
      1,
      0.15
    ]);
  
    map.setPaintProperty("routes-line", "line-width", [
      "case",
      ["==", ["get", "uid"], isolatedUid],
      3,
      1.4
    ]);
  }


  // ---------------- SORT ----------------
  routes = routes.sort(
    (a, b) =>
      new Date(b.journey_date) -
      new Date(a.journey_date)
  );



  // ---------------- RENDER ----------------
  renderRoutes(routes, {
    resetIsolation: true,
  });
}
