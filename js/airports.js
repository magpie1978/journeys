// =====================================================
// AIRPORTS.JS (FINAL, FILTER-SAFE VERSION)
// =====================================================

window.activeAirportFilter = null;

let journeyEndpointsHoverBound = false;
let airportHoverBound = false;
let airportClickBound = false;
let airportClearClickBound = false;

// =====================================================
// LOAD AIRPORT MARKERS
// =====================================================
async function loadAirports(routes) {
  // --------------------------------------------------
  // Hide everything if not in routes mode
  // --------------------------------------------------
  if (mapMode !== "routes") {
    hideAirportLayers();
    return;
  }

  // --------------------------------------------------
  // 1️⃣ FLIGHT AIRPORT MARKERS
  // --------------------------------------------------
  const flightCodes = new Set();

  (routes || []).forEach(r => {
    if (r.journey_type === "Flight") {
      if (r.origin) flightCodes.add(r.origin);
      if (r.destination) flightCodes.add(r.destination);
    }
  });

  if (!flightCodes.size) {
    hideAirportLayers();
  } else {
    const { data, error } = await sb
      .from("journey_locations")
      .select("airport_code, airport, city, country, longitude, latitude")
      .in("airport_code", [...flightCodes]);

    if (error) {
      console.error("[airports] load failed:", error);
    } else {
      renderAirportMarkers(data || []);
    }
  }

  // --------------------------------------------------
  // 2️⃣ NON-FLIGHT ENDPOINTS
  // --------------------------------------------------
  renderNonFlightEndpoints(routes);

  // --------------------------------------------------
  // 3️⃣ CLICK-AWAY HANDLER
  // --------------------------------------------------
  bindAirportClearOnMapClick();
}

// =====================================================
// RENDER AIRPORT MARKERS
// =====================================================
function renderAirportMarkers(data) {
  const airportFC = {
    type: "FeatureCollection",
    features: data
      .filter(a => a.longitude != null && a.latitude != null)
      .map(a => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.longitude, a.latitude] },
        properties: a,
      })),
  };

  if (map.getSource("airports")) {
    map.getSource("airports").setData(airportFC);
  } else {
    map.addSource("airports", { type: "geojson", data: airportFC });

    map.addLayer({
      id: "airports-circle",
      type: "circle",
      source: "airports",
      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000",
      },
    });

    map.addLayer({
      id: "airports-hit",
      type: "circle",
      source: "airports",
      paint: {
        "circle-radius": 18,
        "circle-color": "rgba(0,0,0,0)",
      },
    });

    map.moveLayer("airports-hit");
    map.moveLayer("airports-circle");
  }

  map.setLayoutProperty("airports-circle", "visibility", "visible");
  map.setLayoutProperty("airports-hit", "visibility", "visible");

  bindAirportHover();
  bindAirportClick();
}

// =====================================================
// HOVER TOOLTIP
// =====================================================
function bindAirportHover() {
  if (airportHoverBound) return;
  airportHoverBound = true;

  map.on("mouseenter", "airports-circle", e => {
    map.getCanvas().style.cursor = "pointer";
    const f = e.features?.[0];
    if (!f) return;

    const p = f.properties || {};
    airportPopup
      .setLngLat(f.geometry.coordinates)
      .setHTML(
        `<strong>${p.airport_code || ""}</strong><br/>
         ${p.city || ""}${p.city && p.country ? ", " : ""}${p.country || ""}`
      )
      .addTo(map);
  });

  map.on("mouseleave", "airports-circle", () => {
    map.getCanvas().style.cursor = "";
    airportPopup.remove();
  });
}

// =====================================================
// CLICK AIRPORT (DRILL-DOWN)
// =====================================================
function bindAirportClick() {
  if (airportClickBound) return;
  airportClickBound = true;

  map.on("click", "airports-hit", e => {
    e.originalEvent?.stopPropagation();

    const f = e.features?.[0];
    if (!f) return;

    const airportCode = f.properties?.airport_code;
    if (!airportCode) return;

    filterRoutesByAirport(airportCode);

    if (window.onAirportSelected) {
      window.onAirportSelected({
        code: airportCode,
        city: f.properties.city,
      });
    }
  });
}

// =====================================================
// FILTER ROUTES BY AIRPORT (TEMPORARY)
// =====================================================
function filterRoutesByAirport(airportCode) {
  if (!airportCode || !Array.isArray(currentRoutes)) return;

  // Toggle OFF → restore via filters
  if (window.activeAirportFilter === airportCode) {
    window.activeAirportFilter = null;
    isolatedUid = null;

    if (window.onAirportCleared) {
      window.onAirportCleared();
    }

    loadRoutes(); // 🔥 authoritative restore
    return;
  }

  // Toggle ON
  window.activeAirportFilter = airportCode;
  isolatedUid = null;

  const filtered = currentRoutes.filter(r =>
    r.journey_type === "Flight" &&
    (r.origin === airportCode || r.destination === airportCode)
  );

  renderRoutes(filtered, { resetIsolation: true });

  if (map.getLayer("routes-line")) {
    map.setPaintProperty("routes-line", "line-opacity", 0.85);
  }
}

// =====================================================
// CLICK-AWAY TO CLEAR AIRPORT FILTER
// =====================================================
function bindAirportClearOnMapClick() {
  if (airportClearClickBound) return;
  airportClearClickBound = true;

  map.on("click", e => {
    if (!window.activeAirportFilter) return;
    if (mapMode !== "routes") return;

    const airportHits = map.queryRenderedFeatures(e.point, {
      layers: ["airports-hit"],
    });
    if (airportHits.length) return;

    window.activeAirportFilter = null;
    isolatedUid = null;

    if (window.onAirportCleared) {
      window.onAirportCleared();
    }

    loadRoutes(); // 🔥 restore via filters
  });
}

// =====================================================
// NON-FLIGHT ENDPOINTS
// =====================================================
function renderNonFlightEndpoints(routes) {
  const features = [];

  (routes || []).forEach(r => {
    if (r.journey_type === "Flight") return;
    if (!r.geom?.coordinates?.length) return;

    const coords = r.geom.coordinates;
    features.push(
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: coords[0] },
        properties: { label: r.origin || "Origin" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: coords[coords.length - 1] },
        properties: { label: r.destination || "Destination" },
      }
    );
  });

  const fc = { type: "FeatureCollection", features };

  if (map.getSource("journey-endpoints")) {
    map.getSource("journey-endpoints").setData(fc);
  } else {
    map.addSource("journey-endpoints", { type: "geojson", data: fc });
    map.addLayer({
      id: "journey-endpoints-circle",
      type: "circle",
      source: "journey-endpoints",
      paint: {
        "circle-radius": 5,
        "circle-color": "#FFFFFF",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000",
      },
    });
  }

  map.setLayoutProperty("journey-endpoints-circle", "visibility", "visible");
}

// =====================================================
// HELPERS
// =====================================================
function hideAirportLayers() {
  clearSource("airports");
  clearSource("journey-endpoints");

  if (map.getLayer("airports-circle")) {
    map.setLayoutProperty("airports-circle", "visibility", "none");
  }
  if (map.getLayer("airports-hit")) {
    map.setLayoutProperty("airports-hit", "visibility", "none");
  }
  if (map.getLayer("journey-endpoints-circle")) {
    map.setLayoutProperty("journey-endpoints-circle", "visibility", "none");
  }
}

// =====================================================
// AIRPORT POPUP
// =====================================================
const airportPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});
