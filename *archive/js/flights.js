/* global mapboxgl, supabase */

// =====================================================
// CONFIG
// =====================================================
const SUPABASE_URL = "https://jxmyetsjqkrluxqtevxy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bXlldHNqcWtybHV4cXRldnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzI2NjYsImV4cCI6MjA4MDYwODY2Nn0.YoXEtsY_Zh1Eeuj0kl11AOaj01VrZzGGKoPhJyQP-iU";

mapboxgl.accessToken =
  "pk.eyJ1IjoiY2hyaXMtZHVuaWdhbiIsImEiOiJjbWo4dDRtbGowM25lM2VzYWV0eHhocHp5In0.kO8gJyPmFLqQhz-kTTDyIQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MAX_ROUTES = 1000;

// =====================================================
// MAP INIT
// =====================================================
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: [-1.5, 53.5],
  zoom: 4,
});

map.addControl(new mapboxgl.NavigationControl(), "top-right");

// =====================================================
// DOM ELEMENTS
// =====================================================
const sidebar = document.getElementById("sidebar");
const flightListEl = document.getElementById("flightList");
const sidebarToggle = document.getElementById("sidebarToggle");
const reloadBtn = document.getElementById("reloadBtn");

// Glass boxes
const journeyBox = document.getElementById("journeyCounter");
const milesBox = document.getElementById("milesCounter");
const countriesBox = document.getElementById("countriesCounter");
const airlinesBox = document.getElementById("airlinesCounter");
const durationBox = document.getElementById("durationCounter");

const journeyNumberEl = journeyBox?.querySelector(".glass-number");
const journeyLabelEl = journeyBox?.querySelector(".glass-label");
const milesNumberEl = milesBox?.querySelector(".glass-number");
const countriesNumberEl = countriesBox?.querySelector(".glass-number");
const airlinesNumberEl = airlinesBox?.querySelector(".glass-number");
const durationNumberEl = durationBox?.querySelector(".glass-number");

// =====================================================
// STATE
// =====================================================
let currentRoutes = [];
let isolatedUid = null;
let mapMode = "routes"; // routes | countries
let lastNonIsolatedView = null;


// for “revert to prior view” after isolate
let lastRoutesBounds = null;

const selected = {
  years: new Set(),
  airlines: new Set(),
  types: new Set(),
};

// =====================================================
// HELPERS
// =====================================================
function clearSource(id) {
  if (map.getSource(id)) {
    map.getSource(id).setData({ type: "FeatureCollection", features: [] });
  }
}

function safeText(el, txt) {
  if (el) el.textContent = txt;
}

function formatSecondsToHM(seconds) {
  const s = Number(seconds) || 0;
  if (s <= 0) return "0h 00min";
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return `${hrs}h ${String(mins).padStart(2, "0")}min`;
}

function getSidebarLeftPad() {
  return sidebar?.classList.contains("collapsed")
    ? 80
    : (sidebar?.offsetWidth || 260) + 80;
}

function fitToBoundsFromLineGeoms(geoms) {
  if (!geoms?.length) return;

  const bounds = new mapboxgl.LngLatBounds();
  geoms.forEach(g => {
    if (!g?.coordinates?.length) return;
    g.coordinates.forEach(c => bounds.extend(c));
  });

  map.fitBounds(bounds, {
    padding: {
      top: 140,
      bottom: 80,
      left: getSidebarLeftPad(),
      right: 80,
    },
    duration: 650,
  });
}

function storeCurrentMapBoundsAsLastRoutes() {
  // Save current camera bounds to revert later
  try {
    lastRoutesBounds = map.getBounds();
  } catch {
    lastRoutesBounds = null;
  }
}

function revertToLastRoutesBoundsOrAllRoutes() {
  if (lastRoutesBounds) {
    map.fitBounds(lastRoutesBounds, {
      padding: {
        top: 140,
        bottom: 80,
        left: getSidebarLeftPad(),
        right: 80,
      },
      duration: 650,
    });
  } else {
    fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
  }
}


function updateAllCounters(routes) {
  // Journeys
  updateJourneyCounter(routes.length);

  // Miles
  const totalMiles = routes.reduce(
    (sum, r) => sum + (Number(r.journey_distance) || 0),
    0
  );
  updateMilesCounter(totalMiles);

  // Countries
  const countrySet = new Set(
    routes.map(r => r.destination_country).filter(Boolean)
  );
  updateCountriesCounter(countrySet.size);

  // Airlines
  const airlineSet = new Set(
    routes.map(r => r.airline).filter(Boolean)
  );
  updateAirlinesCounter(airlineSet.size);

  // Duration
  const totalSeconds = routes.reduce(
    (sum, r) => sum + (Number(r.journey_duration_seconds) || 0),
    0
  );
  updateDurationCounter(totalSeconds);
}


// =====================================================
// GLASS COUNTER HELPERS
// =====================================================
function updateJourneyCounter(n) {
  if (!journeyNumberEl || !journeyLabelEl) return;
  journeyNumberEl.textContent = n.toLocaleString();
  journeyLabelEl.textContent = n === 1 ? "JOURNEY" : "JOURNEYS";
}

function updateMilesCounter(miles) {
  if (!milesNumberEl) return;
  milesNumberEl.textContent = Math.round(miles).toLocaleString();
}

function updateCountriesCounter(n) {
  if (!countriesNumberEl) return;
  countriesNumberEl.textContent = n.toLocaleString();
}

function updateAirlinesCounter(n) {
  if (!airlinesNumberEl) return;
  airlinesNumberEl.textContent = n.toLocaleString();
}

function updateDurationCounter(seconds) {
  if (!durationNumberEl) return;
  durationNumberEl.textContent = formatSecondsToHM(seconds);
}




// =====================================================
// SIDEBAR
// =====================================================
function renderSidebar(routes) {
  if (!flightListEl) return;
  flightListEl.innerHTML = "";

  (routes || []).forEach(r => {
    const li = document.createElement("li");
    li.dataset.uid = r.uid;
    li.classList.toggle("active", r.uid === isolatedUid);

    li.innerHTML = `
      <div class="date">${r.journey_date?.slice(0, 10) || ""}</div>
      <div class="route">
        <strong>${r.callsign || ""}</strong>
        ${r.origin || ""} → ${r.destination || ""}
      </div>
    `;

    li.addEventListener("click", () => toggleIsolation(r.uid));
    flightListEl.appendChild(li);
  });
}

// =====================================================
// AIRPORT MARKERS + TOOLTIPS
// =====================================================
const airportPopup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 10,
});

let airportHoverBound = false;

async function loadAirports(routes) {
  // In countries mode we hide airports entirely
  if (mapMode !== "routes") {
    if (map.getLayer("airports-circle")) map.setLayoutProperty("airports-circle", "visibility", "none");
    clearSource("airports");
    return;
  }

  const codes = new Set();
  (routes || []).forEach(r => {
    if (r.origin) codes.add(r.origin);
    if (r.destination) codes.add(r.destination);
  });

  if (!codes.size) {
    clearSource("airports");
    if (map.getLayer("airports-circle")) map.setLayoutProperty("airports-circle", "visibility", "none");
    return;
  }

  const { data, error } = await sb
    .from("journey_locations")
    .select("airport_code, airport, city, country, longitude, latitude")
    .in("airport_code", [...codes]);

  if (error) {
    console.error("[airports] load failed:", error);
    return;
  }

  const fc = {
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
    map.getSource("airports").setData(fc);
  } else {
    map.addSource("airports", { type: "geojson", data: fc });

    map.addLayer({
      id: "airports-circle",
      type: "circle",
      source: "airports",
      paint: {
        "circle-radius": 5,
        "circle-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#000000",
      },
    });
  }

  // ensure visible
  if (map.getLayer("airports-circle")) {
    map.setLayoutProperty("airports-circle", "visibility", "visible");
  }

  // bind hover only once
  if (!airportHoverBound && map.getLayer("airports-circle")) {
    airportHoverBound = true;

    map.on("mouseenter", "airports-circle", e => {
      map.getCanvas().style.cursor = "pointer";
      const f = e.features?.[0];
      if (!f) return;

      const p = f.properties || {};
      const code = p.airport_code || "";
      const city = p.city || "";
      const country = p.country || "";

      airportPopup
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<div style="color:#111;">
             <strong>${code}</strong><br/>
             ${city}${city && country ? ", " : ""}${country}
           </div>`
        )
        .addTo(map);
    });

    map.on("mouseleave", "airports-circle", () => {
      map.getCanvas().style.cursor = "";
      airportPopup.remove();
    });
  }
}

// =====================================================
// ISOLATION (SIDEBAR OR MAP CLICK)
// =====================================================
function toggleIsolation(uid) {
  if (!isolatedUid && uid) {
    // 🔐 Store current map state BEFORE isolating
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

  map.setPaintProperty("routes-line", "line-opacity", [
    "case",
    ["==", ["get", "uid"], isolatedUid],
    1.0,
    isolatedUid ? 0.12 : 0.85,
  ]);

  if (isolatedUid) {
    const r = currentRoutes.find(x => x.uid === isolatedUid);
    if (r) {
      fitToBoundsFromLineGeoms([r.geom]);

      // ✅ Update counters for single flight
      updateAllCounters([r]);
    }
  } else {
    // ✅ Restore counters for all filtered routes
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



// =====================================================
// FILTER UI (checkbox dropdowns)
// =====================================================
function buildFilterMenu(containerId, values, targetSet) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = container.querySelector(".filter-options");
  const toggle = container.querySelector(".filter-toggle");
  const menu = container.querySelector(".filter-menu");
  const selectAll = container.querySelector(".select-all");
  const clear = container.querySelector(".clear");

  if (!list || !toggle || !menu || !selectAll || !clear) return;

  list.innerHTML = "";

  values.forEach(v => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${v}"> ${v}`;
    const cb = label.querySelector("input");
    cb.checked = targetSet.has(v);

    cb.addEventListener("change", () => {
      cb.checked ? targetSet.add(v) : targetSet.delete(v);
      loadRoutes();
    });

    list.appendChild(label);
  });

  selectAll.onclick = () => {
    targetSet.clear();
    values.forEach(v => targetSet.add(v));
    list.querySelectorAll("input").forEach(cb => (cb.checked = true));
    loadRoutes();
  };

  clear.onclick = () => {
    targetSet.clear();
    list.querySelectorAll("input").forEach(cb => (cb.checked = false));
    loadRoutes();
  };

  toggle.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("open");
  };
}

document.addEventListener("click", e => {
  if (e.target.closest(".filter")) return;
  document.querySelectorAll(".filter-menu.open").forEach(m => m.classList.remove("open"));
});

// =====================================================
// LOAD FILTERS (defaults applied: Year=2025 and Type=Flight)
// =====================================================
async function loadFilters() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, airline, journey_type");

  if (error) {
    console.error("[filters] failed:", error);
    return;
  }

  const years = [...new Set(
    (data || []).map(d => d.year && String(d.year).slice(0, 4)).filter(Boolean)
  )].sort((a, b) => b.localeCompare(a));

  const airlines = [...new Set((data || []).map(d => d.airline).filter(Boolean))].sort();
  const types = [...new Set((data || []).map(d => d.journey_type).filter(Boolean))].sort();

  selected.years.clear();
  selected.types.clear();

  // required defaults
  if (years.includes("2025")) selected.years.add("2025");
  if (types.includes("Flight")) selected.types.add("Flight");

  buildFilterMenu("filter-year", years, selected.years);
  buildFilterMenu("filter-airline", airlines, selected.airlines);
  buildFilterMenu("filter-type", types, selected.types);
}

// =====================================================
// COUNTRIES MODE (Mapbox country boundaries)
// =====================================================
function ensureCountriesLayer() {
  if (map.getSource("countries")) return;

  map.addSource("countries", {
    type: "vector",
    url: "mapbox://mapbox.country-boundaries-v1",
  });

  map.addLayer({
    id: "countries-fill",
    type: "fill",
    source: "countries",
    "source-layer": "country_boundaries",
    paint: {
      "fill-color": "#FFD700",
      "fill-opacity": 0.75,
    },
    // start empty
    filter: ["in", "name_en", ""],
  });
}

function setCountriesFilterFromRoutes(routes) {
  ensureCountriesLayer();
  const names = [...new Set((routes || []).map(r => r.destination_country).filter(Boolean))];
  map.setFilter("countries-fill", ["in", "name_en", ...names]);
}

function fitToVisibleCountries() {
  if (!map.getLayer("countries-fill")) return;

  // IMPORTANT: query *rendered* features of the countries-fill layer
  // (this respects the filter, so bounds match highlighted countries only)
  const rendered = map.queryRenderedFeatures({ layers: ["countries-fill"] });

  if (!rendered?.length) return;

  const bounds = new mapboxgl.LngLatBounds();

  rendered.forEach(f => {
    const geom = f.geometry;
    // GeoJSON-like polygons
    if (!geom) return;

    // Mapbox can return MultiPolygon / Polygon; coordinates nesting varies.
    const coords = geom.coordinates;

    // flatten safely
    const flat = (arr) => arr.flat ? arr.flat(Infinity) : arr;
    const points = flat(coords);

    // points is now alternating lon/lat values in some cases; safer:
    // walk original structure as [lng,lat] pairs
    const walk = (c) => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === "number" && typeof c[1] === "number") {
        bounds.extend(c);
        return;
      }
      c.forEach(walk);
    };
    walk(coords);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 140,
      bottom: 80,
      left: getSidebarLeftPad(),
      right: 80,
    },
    duration: 650,
  });
}

function applyMapMode() {
  if (mapMode === "countries") {
    // hide routes + hit buffer + airports
    if (map.getLayer("routes-line")) map.setLayoutProperty("routes-line", "visibility", "none");
    if (map.getLayer("routes-hit")) map.setLayoutProperty("routes-hit", "visibility", "none");
    if (map.getLayer("airports-circle")) map.setLayoutProperty("airports-circle", "visibility", "none");

    const visibleRoutes = isolatedUid
      ? currentRoutes.filter(r => r.uid === isolatedUid)
      : currentRoutes;

    setCountriesFilterFromRoutes(visibleRoutes);

    if (map.getLayer("countries-fill")) map.setLayoutProperty("countries-fill", "visibility", "visible");

    // wait for map to render then fit
    map.once("idle", () => fitToVisibleCountries());
  } else {
    // routes mode
    if (map.getLayer("countries-fill")) map.setLayoutProperty("countries-fill", "visibility", "none");
    if (map.getLayer("routes-line")) map.setLayoutProperty("routes-line", "visibility", "visible");
    if (map.getLayer("routes-hit")) map.setLayoutProperty("routes-hit", "visibility", "visible");
    if (map.getLayer("airports-circle")) map.setLayoutProperty("airports-circle", "visibility", "visible");

    applyIsolation(); // re-apply focusing and counters
  }
}

// =====================================================
// LOAD ROUTES
// =====================================================
async function loadRoutes() {
  // New query = reset isolation + last bounds
  const wasIsolated = !!isolatedUid;
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

    // Hard reset UI so you don't get "silent zeros"
    currentRoutes = [];
    updateAllCounters([]);
    renderSidebar([]);
    clearSource("routes");
    clearSource("airports");
    return;
  }

  currentRoutes = (data || [])
    .filter(r => r.geom)
    .sort((a, b) => new Date(b.journey_date) - new Date(a.journey_date));

  // Update UI
  updateAllCounters(currentRoutes);
  renderSidebar(currentRoutes);

  // Safety
  if (currentRoutes.length > MAX_ROUTES) {
    console.warn("[routes] too many routes:", currentRoutes.length);
    clearSource("routes");
    clearSource("airports");
    return;
  }

  const fc = {
    type: "FeatureCollection",
    features: currentRoutes.map(r => ({
      type: "Feature",
      geometry: r.geom,
      properties: r,
    })),
  };

  if (map.getSource("routes")) {
    map.getSource("routes").setData(fc);
  } else {
    map.addSource("routes", { type: "geojson", data: fc });

    // visible routes
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

    // big invisible hit buffer (so it's easy to click)
    map.addLayer({
      id: "routes-hit",
      type: "line",
      source: "routes",
      paint: {
        "line-width": 18,
        "line-opacity": 0,
      },
    });

    // click route to isolate
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

    // click away to clear isolate
    map.on("click", e => {
      if (!isolatedUid || mapMode !== "routes") return;

      const hits = map.queryRenderedFeatures(e.point, { layers: ["routes-hit"] });
      if (!hits.length) {
        clearIsolation();
      }
    });
  }

  // Airports for current routes
  await loadAirports(currentRoutes);

  // Fit
  if (mapMode === "routes") {
    fitToBoundsFromLineGeoms(currentRoutes.map(r => r.geom));
  } else {
    applyMapMode();
  }
}

// =====================================================
// INIT
// =====================================================
map.on("load", async () => {
  await loadFilters();
  await loadRoutes();
});

reloadBtn?.addEventListener("click", loadRoutes);

sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("collapsed");

  // if sidebar is collapsed, hide list entirely (your requirement)
  if (sidebar?.classList.contains("collapsed")) {
    if (flightListEl) flightListEl.style.display = "none";
  } else {
    if (flightListEl) flightListEl.style.display = "";
  }

  setTimeout(() => {
    map.resize();
    // re-fit for current mode
    if (mapMode === "countries") {
      fitToVisibleCountries();
    } else {
      applyIsolation();
    }
  }, 250);
});

// Countries toggle
countriesBox?.addEventListener("click", () => {
  mapMode = mapMode === "routes" ? "countries" : "routes";
  applyMapMode();
});
