// =====================================================
// ROUTES.JS (FINAL, CORRECT)
// - Year filter applied correctly (ANDed date bounds)
// - Map always reflects Year dropdown
// - No OR logic widening the result set
// =====================================================

// Optional stable base set for airport filtering (filtered set only)
window.allRoutes = window.allRoutes || [];

// Internal flag so we only bind map handlers once
window._routesHandlersBound = window._routesHandlersBound || false;

// =====================================================
// RENDER ROUTES (single pipeline)
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

  if (resetIsolation) {
    isolatedUid = null;
    lastRoutesBounds = null;
  }

  currentRoutes = safeRoutes.slice();
  window.allRoutes = currentRoutes.slice(); // ✅ filtered set only

  // ---------------- UI ----------------
  updateAllCounters(currentRoutes);

  if (airlinesPanel?.classList.contains("visible") && typeof renderAirlinesPanel === "function") {
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

  // ---------------- MAP (hard reset) ----------------
  if (map.getLayer("routes-hit")) map.removeLayer("routes-hit");
  if (map.getLayer("routes-line")) map.removeLayer("routes-line");
  if (map.getSource("routes")) map.removeSource("routes");

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

  // Bind handlers once
  if (!window._routesHandlersBound) {
    window._routesHandlersBound = true;

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

  // Airports for current routes
  if (typeof loadAirports === "function") {
    loadAirports(currentRoutes);
  }

  // Fit / mode handling
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
  // 🚨 Hard guard: never load unfiltered
  if (!selected?.years || selected.years.size === 0) {
    console.warn("[routes] loadRoutes aborted – no year selected yet");
    return;
  }

  let q = sb
    .from("journeys_routes_cache_copy2")
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

  // ✅ CORRECT year filter (ANDed bounds, no OR)
  //if (selected.years.size === 1) {
  //  const y = [...selected.years][0];
  //  q = q
  //    .gte("journey_date", `${y}-01-01`)
  //    .lt("journey_date", `${Number(y) + 1}-01-01`);
  //}


  // ✅ Year filter: supports multiple selected years
  const years = [...selected.years].map(Number);
  
  // Build OR ranges like:
  // (2024-01-01 → 2025-01-01) OR (2025-01-01 → 2026-01-01)
  const yearClauses = years.map(y =>
    `and(journey_date.gte.${y}-01-01,journey_date.lt.${y + 1}-01-01)`
  );
  
  // Apply as OR filter
  q = q.or(yearClauses.join(","));


  
  if (selected.airlines.size) {
    q = q.in("airline", [...selected.airlines]);
  }

  if (selected.types.size) {
    q = q.in("journey_type", [...selected.types].map(t => t?.value ?? t));
  }

  const { data, error } = await q;

  if (error) {
    console.error("[routes] load failed:", error);

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

  const routes = (data || [])
    .filter(r => r && r.geom)
    .sort((a, b) => new Date(b.journey_date) - new Date(a.journey_date));

  renderRoutes(routes, { resetIsolation: true });
}

// =====================================================
// ISOLATION LOGIC (unchanged)
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
