// =====================================================
// AIRPORTS.JS (PATCHED)
// - Fixes broken braces / misplaced layer code
// - Adds airports-hit layer (big click target)
// - Click airport => show all flights to/from that airport
// - Uses window.allRoutes as base dataset
// =====================================================

let journeyEndpointsHoverBound = false;
let airportHoverBound = false;
let airportClickBound = false;
let activeAirportFilter = null;


// =====================================================
// LOAD AIRPORT MARKERS
// =====================================================
async function loadAirports(routes) {
  // Hide everything if not in routes mode
  if (mapMode !== "routes") {
    if (map.getLayer("airports-circle")) {
      map.setLayoutProperty("airports-circle", "visibility", "none");
    }
    if (map.getLayer("airports-hit")) {
      map.setLayoutProperty("airports-hit", "visibility", "none");
    }
    if (map.getLayer("journey-endpoints-circle")) {
      map.setLayoutProperty("journey-endpoints-circle", "visibility", "none");
    }
    clearSource("airports");
    clearSource("journey-endpoints");
    return;
  }

  // ---------------------------------------------
  // 1️⃣ FLIGHT AIRPORT MARKERS
  // ---------------------------------------------
  const flightCodes = new Set();

  (routes || []).forEach(r => {
    if (r.journey_type === "Flight") {
      if (r.origin) flightCodes.add(r.origin);
      if (r.destination) flightCodes.add(r.destination);
    }
  });

  if (flightCodes.size > 0) {
    const { data, error } = await sb
      .from("journey_locations")
      .select("airport_code, airport, city, country, longitude, latitude")
      .in("airport_code", [...flightCodes]);

    if (error) {
      console.error("[airports] load failed:", error);
    } else {
      const airportFC = {
        type: "FeatureCollection",
        features: (data || [])
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

        // Visible circles
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

        // Invisible hit layer (bigger click target)
        map.addLayer({
          id: "airports-hit",
          type: "circle",
          source: "airports",
          paint: {
            "circle-radius": 18,
            "circle-color": "rgba(0,0,0,0)",
          },
        });

        // Bring above basemap POIs
        map.moveLayer("airports-hit");
        map.moveLayer("airports-circle");
      }

      map.setLayoutProperty("airports-circle", "visibility", "visible");
      map.setLayoutProperty("airports-hit", "visibility", "visible");

      // Hover tooltip (bind once) - keep on the visible circle
      if (!airportHoverBound) {
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

      // Click (bind once) - bind to HIT layer
      if (!airportClickBound) {
        airportClickBound = true;

        map.on("click", "airports-hit", e => {
          e.originalEvent?.stopPropagation();

          const f = e.features?.[0];
          if (!f) return;

          const airportCode = f.properties?.airport_code;
          if (!airportCode) return;

          filterRoutesByAirport(airportCode);
        });
      }
    }
  } else {
    clearSource("airports");
    if (map.getLayer("airports-circle")) map.setLayoutProperty("airports-circle", "visibility", "none");
    if (map.getLayer("airports-hit")) map.setLayoutProperty("airports-hit", "visibility", "none");
  }

  // ---------------------------------------------
  // 2️⃣ NON-FLIGHT ORIGIN / DESTINATION ENDPOINTS
  // ---------------------------------------------
  const nonFlightFeatures = buildNonFlightEndpoints(routes);

  const nonFlightFC = {
    type: "FeatureCollection",
    features: nonFlightFeatures,
  };

  if (map.getSource("journey-endpoints")) {
    map.getSource("journey-endpoints").setData(nonFlightFC);
  } else {
    map.addSource("journey-endpoints", { type: "geojson", data: nonFlightFC });

    map.addLayer({
      id: "journey-endpoints-circle",
      type: "circle",
      source: "journey-endpoints",
      paint: {
        "circle-radius": 5,
        "circle-color": "#FFD700",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000",
      },
    });
  }

  map.setLayoutProperty("journey-endpoints-circle", "visibility", "visible");

  // Hover tooltip for non-flight endpoints (bind once)
  if (!journeyEndpointsHoverBound) {
    journeyEndpointsHoverBound = true;

    map.on("mouseenter", "journey-endpoints-circle", e => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const [lng, lat] = f.geometry.coordinates;

      airportPopup
        .setLngLat([lng, lat])
        .setHTML(
          `<strong>${p.label || ""}</strong><br/>
           ${p.journey_type || ""}<br/>
           <small>${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "journey-endpoints-circle", () => {
      map.getCanvas().style.cursor = "";
      airportPopup.remove();
    });
  }
}


// =====================================================
// FILTER ROUTES BY AIRPORT
// =====================================================
function filterRoutesByAirport(airportCode) {
  const baseRoutes =
    Array.isArray(window.allRoutes) && window.allRoutes.length
      ? window.allRoutes
      : (currentRoutes || []);

  if (!airportCode || !baseRoutes.length) return;

  // Toggle off
  if (activeAirportFilter === airportCode) {
    activeAirportFilter = null;
    const all = baseRoutes.slice();

    currentRoutes = all;
    if (typeof window.renderRoutes === "function") window.renderRoutes(all, { resetIsolation: true });
    loadAirports(all);
    return;
  }

  activeAirportFilter = airportCode;

  const filtered = baseRoutes.filter(r =>
    r.journey_type === "Flight" &&
    (r.origin === airportCode || r.destination === airportCode)
  );

  currentRoutes = filtered;
  if (typeof window.renderRoutes === "function") window.renderRoutes(filtered, { resetIsolation: true });
  loadAirports(filtered);
}


// =====================================================
// NON-FLIGHT ENDPOINTS BUILDER
// =====================================================
function buildNonFlightEndpoints(routes) {
  const features = [];

  (routes || []).forEach(r => {
    if (r.journey_type === "Flight") return;
    if (!r.geom?.coordinates?.length) return;

    const coords = r.geom.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];

    features.push(
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: start },
        properties: {
          kind: "origin",
          journey_type: r.journey_type,
          label: r.origin || "Origin",
        },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: end },
        properties: {
          kind: "destination",
          journey_type: r.journey_type,
          label: r.destination || "Destination",
        },
      }
    );
  });

  return features;
}


// =====================================================
// AIRPORT POPUP
// =====================================================
const airportPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});
