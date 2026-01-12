// =====================================================
// ROUTES.JS (FULLY PATCHED) 
// - Safe Supabase queries (no 400s)
// - Robust error handling (no JS crashes)
// - Single render pipeline
// - Isolation logic hardened
// - Compatible with MATERIALISED VIEW
// =====================================================

// Stable base set for airport filtering
window.allRoutes = window.allRoutes || [];

// =====================================================
// RENDER ROUTES (single pipeline)
// =====================================================
function renderRoutes(routes, { resetIsolation = true } = {}) {
  routes = (routes || []).filter(r => r && r.geom);

  if (!routes.length) {
    currentRoutes = [];
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

  currentRoutes = routes.slice();
  updateAllCounters(currentRoutes);

  if (airlinesPanel?.classList.contains("visible")) {
    renderAirlinesPanel(currentRoutes);
  }

  renderSidebar(currentRoutes);

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

    map.on("click", e => {
      if (!isolatedUid || mapMode !== "routes") return;
      const hits = map.queryRenderedFeatures(e.point, { layers: ["routes-hit"] });
      if (!hits.length) clearIsolation();
    });
  }

  if (typeof loadAirports === "function") {
    loadAirports(currentRoutes);
  }

  if (mapMode === "routes") {
    fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
  } else {
    applyMapMode();
  }
}

// Expose globally
window.renderRoutes = renderRoutes;

// =====================================================
// LOAD ROUTES
// =====================================================
async function loadRoutes() {
  let q = sb
    .from("journeys_routes_cache")
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

  // ✅ Correct filters (PostgREST-safe)
  if (selected.years.size) {
    const years = [...selected.years];
    q = q.or(
      years
        .map(y => `journey_date.gte.${y}-01-01,journey_date.lt.${Number(y) + 1}-01-01`)
        .join(",")
    );
  }

  if (selected.airlines.size) {
    q = q.in("airline", [...selected.airlines]);
  }

   if (selected.types.size) {
    q = q.in(
      "journey_type",
      [...selected.types].map(t => t.value ?? t)
    );
  }


  const { data, error } = await q;

  if (error) {
    console.error("[routes] load failed:", error);

    currentRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);

    if (typeof clearSource === "function") {
      clearSource("routes");
      clearSource("airports");
    }
    return;
  }

  const routes = (data || [])
    .filter(r => r.geom)
    .sort((a, b) => new Date(b.journey_date) - new Date(a.journey_date));

  if (routes.length > MAX_ROUTES) {
    console.warn("[routes] too many routes:", routes.length);

    currentRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);

    if (typeof clearSource === "function") {
      clearSource("routes");
      clearSource("airports");
    }
    return;
  }

  window.allRoutes = routes.slice();
  renderRoutes(routes, { resetIsolation: true });
}

// =====================================================
// ISOLATION LOGIC
// =====================================================
function toggleIsolation(uid) {
  if (!isolatedUid && uid) {
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

      if (!window.activeAirportFilter && typeof showFlightSummary === "function") {
        showFlightSummary(r);
      }
    }
  } else {
    updateAllCounters(currentRoutes);

    if (typeof hideFlightSummary === "function") {
      hideFlightSummary();
    }

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
