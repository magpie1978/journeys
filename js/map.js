// =====================================================
// MAP.JS
// Map creation, camera fitting and map-mode management
// =====================================================


// =====================================================
// SAFE GLOBAL STATE
// =====================================================

if (typeof window.lastRoutesBounds === "undefined") {
  window.lastRoutesBounds = null;
}

if (typeof window.lastRoutesView === "undefined") {
  window.lastRoutesView = null;
}

if (typeof window._prevMapMode === "undefined") {
  window._prevMapMode = "routes";
}


// =====================================================
// MAP INITIALISATION
// =====================================================

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",

  // UK-centred initial view
  center: [-1.5, 53.5],
  zoom: 4
});

map.addControl(
  new mapboxgl.NavigationControl(),
  "top-right"
);

window.map = map;


// =====================================================
// STATE HELPERS
// =====================================================

function getCurrentMapMode() {
  if (window.appState?.mode) {
    return window.appState.mode;
  }

  if (typeof mapMode !== "undefined") {
    return mapMode;
  }

  return "routes";
}


function getCurrentIsolatedUid() {
  if (window.appState?.isolatedUid) {
    return window.appState.isolatedUid;
  }

  if (typeof isolatedUid !== "undefined") {
    return isolatedUid;
  }

  return null;
}


function getCurrentRoutes() {
  if (Array.isArray(window.currentRoutes)) {
    return window.currentRoutes;
  }

  /*
   * Compatibility with files that still expose
   * currentRoutes as a standalone global variable.
   */
  if (
    typeof currentRoutes !== "undefined" &&
    Array.isArray(currentRoutes)
  ) {
    return currentRoutes;
  }

  return [];
}


// =====================================================
// GENERIC MAP HELPERS
// =====================================================

function setMapLayerVisibility(
  layerId,
  visibility
) {
  if (!map.getLayer(layerId)) {
    return;
  }

  map.setLayoutProperty(
    layerId,
    "visibility",
    visibility
  );
}


/*
 * Recursively walks through nested GeoJSON coordinate
 * arrays and passes each valid longitude/latitude pair
 * to the supplied callback.
 */
function walkCoordinates(
  coordinates,
  callback
) {
  if (!Array.isArray(coordinates)) {
    return;
  }

  const longitude =
    Number(coordinates[0]);

  const latitude =
    Number(coordinates[1]);

  if (
    coordinates.length >= 2 &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude)
  ) {
    callback([
      longitude,
      latitude
    ]);

    return;
  }

  coordinates.forEach(item => {
    walkCoordinates(item, callback);
  });
}


// =====================================================
// BASE MAP CLEANUP
// =====================================================

function hideSubCountryBorders() {
  const layers =
    map.getStyle()?.layers || [];

  layers.forEach(layer => {
    const layerId =
      String(layer.id || "");

    const isSubCountryBorder =
      layerId.includes("admin-1") ||
      layerId.includes("admin-2") ||
      layerId.includes("boundary-state") ||
      layerId.includes("boundary-province");

    if (!isSubCountryBorder) {
      return;
    }

    setMapLayerVisibility(
      layerId,
      "none"
    );
  });
}


function hideCityLabels() {
  const layers =
    map.getStyle()?.layers || [];

  layers.forEach(layer => {
    const layerId =
      String(layer.id || "");

    const isCityLabel =
      layerId.includes("place-city") ||
      layerId.includes("place-town") ||
      layerId.includes("place-village") ||
      layerId.includes("settlement") ||
      (
        layerId.includes("place-label") &&
        !layerId.includes("country")
      );

    if (!isCityLabel) {
      return;
    }

    setMapLayerVisibility(
      layerId,
      "none"
    );
  });
}

window.hideSubCountryBorders =
  hideSubCountryBorders;

window.hideCityLabels =
  hideCityLabels;


// =====================================================
// ROUTE CAMERA FITTING
// =====================================================

function fitToBoundsFromLineGeoms(geometries) {
  if (
    !Array.isArray(geometries) ||
    geometries.length === 0
  ) {
    return;
  }

  const bounds =
    new mapboxgl.LngLatBounds();

  let validCoordinateCount = 0;

  geometries.forEach(geometry => {
    if (!geometry) {
      return;
    }

    /*
     * Accept either:
     * - a GeoJSON geometry object; or
     * - a raw nested coordinate array.
     */
    const coordinates =
      geometry.coordinates ||
      geometry;

    walkCoordinates(
      coordinates,
      coordinate => {
        bounds.extend(coordinate);
        validCoordinateCount += 1;
      }
    );
  });

  if (
    validCoordinateCount === 0 ||
    bounds.isEmpty()
  ) {
    console.warn(
      "[map] No valid coordinates were available for camera fitting"
    );

    return;
  }

  const west =
    bounds.getWest();

  const east =
    bounds.getEast();

  const south =
    bounds.getSouth();

  const north =
    bounds.getNorth();

  const longitudeSpan =
    east - west;

  const latitudeSpan =
    north - south;

  /*
   * Expand geographic bounds before applying the
   * Mapbox pixel padding.
   *
   * The larger vertical percentage gives tall routes
   * more space above and below their endpoints.
   */
  const horizontalExpansion =
    Math.max(
      longitudeSpan * 0.10,
      0.05
    );

  const verticalExpansion =
    Math.max(
      latitudeSpan * 0.15,
      0.05
    );

  const expandedBounds =
    new mapboxgl.LngLatBounds(
      [
        west - horizontalExpansion,
        south - verticalExpansion
      ],
      [
        east + horizontalExpansion,
        north + verticalExpansion
      ]
    );

  const leftPadding =
    typeof getSidebarLeftPad === "function"
      ? getSidebarLeftPad()
      : 100;

  map.fitBounds(
    expandedBounds,
    {
      padding: {
        top: 100,
        bottom: 100,
        left: leftPadding,
        right: 100
      },

      duration: 650,
      essential: true
    }
  );
}

window.fitToBoundsFromLineGeoms =
  fitToBoundsFromLineGeoms;


// =====================================================
// ROUTE VIEW SNAPSHOT
// =====================================================

function storeCurrentMapViewAsLastRoutes() {
  window.lastRoutesView = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch()
  };

  window.lastRoutesBounds =
    map.getBounds();
}


// =====================================================
// RESTORE ROUTE VIEW
// =====================================================

function restoreLastRoutesViewOrBoundsOrAllRoutes() {
  /*
   * Stop any camera animation started while entering
   * Countries mode.
   */
  map.stop();

  // Best option: restore exact centre and zoom.
  if (window.lastRoutesView) {
    map.easeTo({
      center:
        window.lastRoutesView.center,

      zoom:
        window.lastRoutesView.zoom,

      bearing:
        window.lastRoutesView.bearing,

      pitch:
        window.lastRoutesView.pitch,

      duration: 650,
      essential: true
    });

    return;
  }

  // Fallback: restore the saved map bounds.
  if (window.lastRoutesBounds) {
    const leftPadding =
      typeof getSidebarLeftPad === "function"
        ? getSidebarLeftPad() + 80
        : 180;

    map.fitBounds(
      window.lastRoutesBounds,
      {
        padding: {
          top: 320,
          bottom: 180,
          left: leftPadding,
          right: 120
        },

        duration: 650,
        essential: true
      }
    );

    return;
  }

  /*
   * Final fallback: calculate the view again from all
   * currently displayed route geometries.
   */
  const geometries =
    getCurrentRoutes()
      .map(route => route?.geom)
      .filter(Boolean);

  fitToBoundsFromLineGeoms(
    geometries
  );
}

window.storeCurrentMapViewAsLastRoutes =
  storeCurrentMapViewAsLastRoutes;

window.restoreLastRoutesViewOrBoundsOrAllRoutes =
  restoreLastRoutesViewOrBoundsOrAllRoutes;


// =====================================================
// COUNTRIES LAYER
// =====================================================

function ensureCountriesLayer() {
  if (!map.getSource("countries")) {
    map.addSource("countries", {
      type: "vector",
      url:
        "mapbox://mapbox.country-boundaries-v1"
    });
  }

  if (!map.getLayer("countries-fill")) {
    map.addLayer({
      id: "countries-fill",
      type: "fill",
      source: "countries",
      "source-layer":
        "country_boundaries",

      paint: {
  "fill-color": "#CCFF00",
  "fill-opacity": 0.32
},

      /*
       * Begin with a filter that matches no real
       * country until route countries are supplied.
       */
      filter: [
        "in",
       "iso_3166_1_alpha_3",
        ""
      ]
    });
  }
}


// =====================================================
// COUNTRY FILTER FROM ROUTES
// Uses ISO-3 codes from journey_countries_mv
// =====================================================

async function setCountriesFilterFromRoutes(
  routes = []
) {
  ensureCountriesLayer();

  const uids =
    routes
      .map(route => route?.uid)
      .filter(Boolean)
      .map(String);

  if (!uids.length) {
    map.setFilter(
      "countries-fill",
      [
        "in",
        "iso_3166_1_alpha_3",
        ""
      ]
    );

    return;
  }

  const {
    data,
    error
  } = await sb.rpc(
    "get_countries_for_journeys",
    {
      journey_uids: uids
    }
  );

  if (error) {
    console.error(
      "[map] Country lookup failed:",
      error
    );

    map.setFilter(
      "countries-fill",
      [
        "in",
        "iso_3166_1_alpha_3",
        ""
      ]
    );

    return;
  }

  const countryCodes =
    [
      ...new Set(
        (data || [])
          .map(row => row.iso3)
          .filter(Boolean)
      )
    ];

  map.setFilter(
    "countries-fill",
    [
      "in",
      "iso_3166_1_alpha_3",
      ...countryCodes
    ]
  );
}

window.setCountriesFilterFromRoutes =
  setCountriesFilterFromRoutes;


// =====================================================
// FIT TO VISIBLE COUNTRIES
// =====================================================

function fitToVisibleCountries() {
  if (!map.getLayer("countries-fill")) {
    return;
  }

  const renderedCountries =
    map.queryRenderedFeatures({
      layers: ["countries-fill"]
    });

  if (!renderedCountries.length) {
    return;
  }

  const bounds =
    new mapboxgl.LngLatBounds();

  renderedCountries.forEach(feature => {
    walkCoordinates(
      feature.geometry?.coordinates,
      coordinate => {
        bounds.extend(coordinate);
      }
    );
  });

  if (bounds.isEmpty()) {
    return;
  }

  const leftPadding =
    typeof getSidebarLeftPad === "function"
      ? getSidebarLeftPad() + 80
      : 180;

  map.fitBounds(
    bounds,
    {
      padding: {
        top: 320,
        bottom: 180,
        left: leftPadding,
        right: 120
      },

      duration: 650,
      essential: true
    }
  );
}

window.fitToVisibleCountries =
  fitToVisibleCountries;


// =====================================================
// MAP MODE SWITCHING
// =====================================================

function applyMapMode() {
  const currentMode =
    getCurrentMapMode();

  const previousMode =
    window._prevMapMode;

  // -------------------------------------------------
  // COUNTRIES MODE
  // -------------------------------------------------

  if (currentMode === "countries") {
    /*
     * Store the Routes view only when genuinely
     * switching into Countries mode.
     */
    if (previousMode !== "countries") {
      storeCurrentMapViewAsLastRoutes();
    }

    setMapLayerVisibility(
      "routes-line",
      "none"
    );

    setMapLayerVisibility(
      "routes-hit",
      "none"
    );

    setMapLayerVisibility(
      "airports-circle",
      "none"
    );

    setMapLayerVisibility(
      "journey-endpoints-circle",
      "none"
    );

    const currentRoutes =
      getCurrentRoutes();

    const isolatedRouteUid =
      getCurrentIsolatedUid();

    const visibleRoutes =
      isolatedRouteUid
        ? currentRoutes.filter(route =>
            String(route.uid) ===
            String(isolatedRouteUid)
          )
        : currentRoutes;

      setCountriesFilterFromRoutes(
        visibleRoutes
      ).then(() => {
      
        /*
         * The user may have switched back to Routes
         * while the Supabase request was running.
         */
        if (
          getCurrentMapMode() !==
          "countries"
        ) {
          return;
        }
      
        setMapLayerVisibility(
          "countries-fill",
          "visible"
        );
      
        map.once(
          "idle",
          fitToVisibleCountries
        );
      });
  }

  // -------------------------------------------------
  // ROUTES MODE
  // -------------------------------------------------

  else {
    setMapLayerVisibility(
      "countries-fill",
      "none"
    );

    setMapLayerVisibility(
      "routes-line",
      "visible"
    );

    setMapLayerVisibility(
      "routes-hit",
      "visible"
    );

    setMapLayerVisibility(
      "airports-circle",
      "visible"
    );

    setMapLayerVisibility(
      "journey-endpoints-circle",
      "visible"
    );

    /*
     * Restore the previous Routes camera after Mapbox
     * has applied the layer visibility changes.
     */
    map.once("idle", () => {
      restoreLastRoutesViewOrBoundsOrAllRoutes();

      const isolatedRouteUid =
        getCurrentIsolatedUid();

      /*
       * Compatibility with older route-highlighting code.
       */
      if (
        isolatedRouteUid &&
        typeof highlightIsolatedRoute ===
          "function"
      ) {
        highlightIsolatedRoute(
          isolatedRouteUid
        );
      } else if (
        typeof applyIsolationStyling ===
          "function"
      ) {
        applyIsolationStyling();
      }
    });
  }

  window._prevMapMode =
    currentMode;
}

window.applyMapMode =
  applyMapMode;


// =====================================================
// AIRPORT SELECTION HOOKS
// =====================================================

window.onAirportSelected =
  function onAirportSelected(
    airportProperties
  ) {
    if (
      typeof window.showAirportSummary ===
      "function"
    ) {
      window.showAirportSummary(
        airportProperties
      );
    }
  };


window.onAirportCleared =
  function onAirportCleared() {
    if (
      typeof window.hideAirportSummary ===
      "function"
    ) {
      window.hideAirportSummary();
    }
  };
