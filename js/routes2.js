
// =====================================================
// ROUTES.JS (PATCHED)
// - Fixes syntax truncation
// - Adds reusable renderRoutes() and exposes it globally
// - Removes duplicate rendering in loadRoutes()
// - Preserves isolation logic + click handlers
// =====================================================

// Optional but recommended: keep a stable "full set" for airport filtering
// airports.js will use window.allRoutes if present.
window.allRoutes = window.allRoutes || [];

function renderRoutes(routes, { resetIsolation = true } = {}) {
  // Defensive: normalize
  routes = (routes || []).filter(r => r && r.geom);

  if (!routes.length) {
    currentRoutes = [];
    clearSource("routes");
    clearSource("airports");
    updateAllCounters([]);
    renderSidebar([]);
    return;
  }

  // For external filters (airport click etc.), we generally want to reset isolation
  if (resetIsolation) {
    isolatedUid = null;
    lastRoutesBounds = null;
  }

  // Keep currentRoutes in sync with what is actually shown
  currentRoutes = routes.slice();

  // ---------------- UI ----------------
  updateAllCounters(currentRoutes);

  if (airlinesPanel?.classList.contains("visible")) {
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

  // ---------------- MAP ----------------
  if (map.getSource("routes")) {
    map.getSource("routes").setData(fc);
  } else {
    map.addSource("routes", { type: "geojson", data: fc });

    // Visible routes
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

    // Big invisible hit buffer (easy to click)
    map.addLayer({
      id: "routes-hit",
      type: "line",
      source: "routes",
      paint: {
        "line-width": 18,
        "line-opacity": 0,
      },
    });

    // Click route to isolate
    map.on("click", "routes-hit", e => {
      const uid = e.features?.[0]?.properties?.uid;
      if (uid) toggleIsolation(uid);
    });

    map.on("mouseenter", "routes-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "routes-hit", () => {
      map.getCanvas().style.cursor = "";
    });

    // Click away to clear isolate
    map.on("click", e => {
      if (!isolatedUid || mapMode !== "routes") return;
      const hits = map.queryRenderedFeatures(e.point, { layers: ["routes-hit"] });
      if (!hits.length) clearIsolation();
    });
  }

  // Airports for current routes (async but we don't need to await here)
  if (typeof loadAirports === "function") {
    loadAirports(currentRoutes);
  }

  // Fit
  if (mapMode === "routes") {
    fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
  } else {
    applyMapMode();
  }
}

// Expose globally so airports.js can call it
window.renderRoutes = renderRoutes;


// =====================================================
// LOAD ROUTES
// =====================================================
async function loadRoutes() {
  // Reset isolation + last bounds
  isolatedUid = null;
  lastRoutesBounds = null;

  let q = sb.from("journeys_routes_cache").select("*");

  if (selected.years.size) {
    q = q.in("year", [...selected.years].map(y => `${y}-01-01`));
  }
  if (selected.airlines.size) q = q.in("airline", [...selected.airlines]);
  if (selected.types.size) q = q.in("journey_type", [...selected.types]);

  const { data, error } = await q;

  if (error) {
    console.error("[routes] load failed:", error);
    currentRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);
    clearSource("routes");
    clearSource("airports");
    return;
  }

  const routes = (data || [])
    .filter(r => r.geom)
    .sort((a, b) => new Date(b.journey_date) - new Date(a.journey_date));

  // Safety
  if (routes.length > MAX_ROUTES) {
    console.warn("[routes] too many routes:", routes.length);
    currentRoutes = [];
    clearSource("routes");
    clearSource("airports");
    updateAllCounters([]);
    renderSidebar([]);
    return;
  }

  // ✅ Stable base set for airport filtering
  window.allRoutes = routes.slice();

  // ✅ Single render pipeline
  renderRoutes(routes, { resetIsolation: true });
}


// =====================================================
// ISOLATION LOGIC (SIDEBAR OR MAP CLICK)
// =====================================================
function toggleIsolation(uid) {
  if (!isolatedUid && uid) {
    // Store current map state BEFORE isolating
    const center = map.getCenter();
    lastNonIsolatedView = {
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
  }

  isolatedUid = isolatedUid === uid ? null : uid;
  applyIsolation();
}

function clearIsolation() {
  if (!isolatedUid) return;
  isolatedUid = null;
  applyIsolation();
}

function applyIsolation() {
  if (!map.getLayer("routes-line")) return;

// If an airport filter is active, do NOT fade routes
if (window.activeAirportFilter) {
  map.setPaintProperty("routes-line", "line-opacity", 0.85);
} else {
  map.setPaintProperty("routes-line", "line-opacity", [
    "case",
    ["==", ["get", "uid"], isolatedUid],
    1.0,
    isolatedUid ? 0.12 : 0.85,
  ]);
}

  if (isolatedUid) {
    const r = currentRoutes.find(x => x.uid === isolatedUid);
    if (r) {
      fitToBoundsFromLineGeoms([r.geom]);
      updateAllCounters([r]);
    }
  } else {
    updateAllCounters(currentRoutes);

    if (lastNonIsolatedView) {
      map.easeTo({
        center: lastNonIsolatedView.center,
        zoom: lastNonIsolatedView.zoom,
        bearing: lastNonIsolatedView.bearing,
        pitch: lastNonIsolatedView.pitch,
        duration: 600,
      });
    }
  }

  [...flightListEl.children].forEach(li => {
    li.classList.toggle("active", li.dataset.uid === isolatedUid);
  });
}
