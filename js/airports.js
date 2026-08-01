// =====================================================
// AIRPORTS.JS — FINAL UNIFIED BUILD
// =====================================================

window.activeAirportFilter = null;

let airportHoverBound = false;
let airportClickBound = false;
let airportClearClickBound = false;
let nonFlightHoverBound = false;


// =====================================================
// LOAD AIRPORTS + ENDPOINTS
// =====================================================
async function loadAirports(routes) {

  if (mapMode !== "routes") {
    hideAirportLayers();
    return;
  }

  // --------------------------------------------------
  // 1️⃣ FLIGHT AIRPORT MARKERS
  // --------------------------------------------------
  const flightCodes = new Set();

  (routes || []).forEach(r => {
    if ((r.journey_type || "").toLowerCase() === "flight") {
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
// RENDER FLIGHT AIRPORT MARKERS
// =====================================================
function renderAirportMarkers(data) {

  const airportFC = {
    type: "FeatureCollection",
    features: data
      .filter(a => a.longitude != null && a.latitude != null)
      .map(a => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [a.longitude, a.latitude]
        },
        properties: a
      })),
  };

  if (map.getSource("airports")) {
    map.getSource("airports").setData(airportFC);
  } else {

    map.addSource("airports", {
      type: "geojson",
      data: airportFC
    });

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
// RENDER NON-FLIGHT ENDPOINT MARKERS
// =====================================================
function renderNonFlightEndpoints(routes) {

  const endpointFC = {
    type: "FeatureCollection",
    features: (routes || [])
      .filter(r =>
        (r.journey_type || "").toLowerCase() !== "flight" &&
        r.geom?.coordinates?.length
      )
      .flatMap(r => {

        const coords = r.geom.coordinates;

        return [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: coords[0]
            },
            properties: {
              type: r.journey_type,
              from: r.origin || "",
              to: r.destination || "",
              date: r.journey_date || ""
            }
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: coords[coords.length - 1]
            },
            properties: {
              type: r.journey_type,
              from: r.origin || "",
              to: r.destination || "",
              date: r.journey_date || ""
            }
          }
        ];
      })
  };

  if (map.getSource("journey-endpoints")) {
    map.getSource("journey-endpoints").setData(endpointFC);
  } else {

    map.addSource("journey-endpoints", {
      type: "geojson",
      data: endpointFC
    });

    map.addLayer({
      id: "journey-endpoints-circle",
      type: "circle",
      source: "journey-endpoints",
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000"
      }
    });

    map.addLayer({
      id: "journey-endpoints-hit",
      type: "circle",
      source: "journey-endpoints",
      paint: {
        "circle-radius": 18,
        "circle-color": "rgba(0,0,0,0)"
      }
    });

    map.moveLayer("journey-endpoints-hit");
    map.moveLayer("journey-endpoints-circle");
  }

  bindNonFlightHover();
}



// =====================================================
// AIRPORT HOVER TOOLTIP
// =====================================================
const airportPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});

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
      .setHTML(`
        <strong>${p.airport_code || ""}</strong><br/>
        ${p.city || ""}${p.city && p.country ? ", " : ""}${p.country || ""}
      `)
      .addTo(map);
  });

  map.on("mouseleave", "airports-circle", () => {
    map.getCanvas().style.cursor = "";
    airportPopup.remove();
  });
}



// =====================================================
// NON-FLIGHT HOVER TOOLTIP
// =====================================================
const nonFlightPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
  className: "journey-tooltip"
});

function bindNonFlightHover() {

  if (nonFlightHoverBound) return;
  nonFlightHoverBound = true;

  map.on("mouseenter", "journey-endpoints-circle", e => {

    map.getCanvas().style.cursor = "pointer";

    const f = e.features?.[0];
    if (!f) return;

    const p = f.properties || {};

    nonFlightPopup
      .setLngLat(f.geometry.coordinates)
      .setHTML(`
        <div style="font-size:12px;">
          <strong>${p.type || "Journey"}</strong><br/>
          ${p.from} → ${p.to}<br/>
          ${p.date}
        </div>
      `)
      .addTo(map);
  });

  map.on("mouseleave", "journey-endpoints-circle", () => {
    map.getCanvas().style.cursor = "";
    nonFlightPopup.remove();
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
// FILTER ROUTES BY AIRPORT
// =====================================================
function filterRoutesByAirport(airportCode) {

  if (!airportCode || !Array.isArray(currentRoutes)) return;

  if (window.activeAirportFilter === airportCode) {
    window.activeAirportFilter = null;
    isolatedUid = null;

    if (window.onAirportCleared) {
      window.onAirportCleared();
    }

    loadRoutes();
    return;
  }

  window.activeAirportFilter = airportCode;
  isolatedUid = null;

  const filtered = currentRoutes.filter(r =>
    r.journey_type === "Flight" &&
    (r.origin === airportCode || r.destination === airportCode)
  );

  renderRoutes(filtered, { resetIsolation: true });
}



// =====================================================
// CLICK-AWAY CLEAR
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

    loadRoutes();
  });
}



// =====================================================
// HIDE LAYERS
// =====================================================
function hideAirportLayers() {

  clearSource("airports");
  clearSource("journey-endpoints");

  ["airports-circle","airports-hit","journey-endpoints-circle"]
    .forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id,"visibility","none");
      }
    });
}
