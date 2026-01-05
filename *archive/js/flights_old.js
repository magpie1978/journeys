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
const flightListEl = document.getElementById("flightList");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const reloadBtn = document.getElementById("reloadBtn");

// Glass counters
const journeyBox = document.getElementById("journeyCounter");
const journeyNumberEl = journeyBox?.querySelector(".glass-number");
const journeyLabelEl = journeyBox?.querySelector(".glass-label");

const milesBox = document.getElementById("milesCounter");
const milesNumberEl = milesBox?.querySelector(".glass-number");

const countriesBox = document.getElementById("countriesCounter");
const countriesNumberEl = countriesBox?.querySelector(".glass-number");

const airlinesBox = document.getElementById("airlinesCounter");
const airlinesNumberEl = airlinesBox?.querySelector(".glass-number");

const durationBox = document.getElementById("durationCounter");
const durationNumberEl = durationBox?.querySelector(".glass-number");

// =====================================================
// STATE
// =====================================================
let currentRoutes = [];
let isolatedUid = null;

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

function fitToBoundsFromGeoms(geoms) {
  if (!geoms?.length) return;
  const bounds = new mapboxgl.LngLatBounds();
  geoms.forEach(g => g?.coordinates?.forEach(c => bounds.extend(c)));
  map.fitBounds(bounds, {
    padding: { top: 140, bottom: 80, left: 80, right: 80 },
    duration: 600,
  });
}

// =====================================================
// ANIMATION HELPERS
// =====================================================
function animateNumber(el, from, to) {
  if (!el) return;
  const start = performance.now();
  const duration = 420;

  function step(t) {
    const p = Math.min((t - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0h 00min";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

// =====================================================
// COUNTERS
// =====================================================
function updateCounters(routes) {
  const journeys = routes.length;
  const miles = routes.reduce((s, r) => s + (r.journey_distance || 0), 0);
  const countries = new Set(routes.map(r => r.destination_country).filter(Boolean)).size;
  const airlines = new Set(routes.map(r => r.airline).filter(Boolean)).size;
  const duration = routes.reduce((s, r) => s + (r.journey_duration_seconds || 0), 0);

  animateNumber(journeyNumberEl, Number(journeyNumberEl?.textContent || 0), journeys);
  journeyLabelEl.textContent = journeys === 1 ? "journey" : "journeys";
  animateNumber(milesNumberEl, Number(milesNumberEl?.textContent || 0), Math.round(miles));
  animateNumber(countriesNumberEl, Number(countriesNumberEl?.textContent || 0), countries);
  animateNumber(airlinesNumberEl, Number(airlinesNumberEl?.textContent || 0), airlines);

  if (durationNumberEl) {
    durationNumberEl.textContent = formatDuration(duration);
  }
}

// =====================================================
// SIDEBAR
// =====================================================
function renderSidebar(routes) {
  flightListEl.innerHTML = "";
  routes.forEach(r => {
    const li = document.createElement("li");
    li.dataset.uid = r.uid;
    li.innerHTML = `
      <div class="date">${r.journey_date || ""}</div>
      <div class="route"><strong>${r.callsign || ""}</strong> ${r.origin} → ${r.destination}</div>
    `;
    if (r.uid === isolatedUid) li.classList.add("active");
    li.onclick = () => toggleIsolation(r.uid);
    flightListEl.appendChild(li);
  });
}

// =====================================================
// ISOLATION
// =====================================================
function toggleIsolation(uid) {
  isolatedUid = isolatedUid === uid ? null : uid;
  applyIsolation();
}

function applyIsolation() {
  if (!map.getLayer("routes-line")) return;

  map.setPaintProperty("routes-line", "line-opacity", [
    "case",
    ["==", ["get", "uid"], isolatedUid],
    1,
    isolatedUid ? 0.12 : 0.85,
  ]);

  const routes = isolatedUid
    ? currentRoutes.filter(r => r.uid === isolatedUid)
    : currentRoutes;

  updateCounters(routes);
  renderSidebar(routes);

  fitToBoundsFromGeoms(routes.map(r => r.geom));
}

// =====================================================
// LOAD ROUTES
// =====================================================
async function loadRoutes() {
  isolatedUid = null;

  let q = sb.from("journeys_routes_cache").select("*");

  if (selected.years.size) {
    q = q.in("year", [...selected.years].map(y => `${y}-01-01`));
  }
  if (selected.airlines.size) q = q.in("airline", [...selected.airlines]);
  if (selected.types.size) q = q.in("journey_type", [...selected.types]);

  const { data, error } = await q;
  if (error) return console.error(error);

  currentRoutes = data.sort((a, b) => new Date(b.journey_date) - new Date(a.journey_date));

  updateCounters(currentRoutes);
  renderSidebar(currentRoutes);

  const features = currentRoutes.map(r => ({
    type: "Feature",
    geometry: r.geom,
    properties: r,
  }));

  if (map.getSource("routes")) {
    map.getSource("routes").setData({ type: "FeatureCollection", features });
  } else {
    map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features } });

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

    // HIT LAYER
    map.addLayer({
      id: "routes-hit",
      type: "line",
      source: "routes",
      paint: { "line-width": 18, "line-opacity": 0 },
    });

    // CLICK ISOLATION
    map.on("click", "routes-hit", e => {
      toggleIsolation(e.features[0].properties.uid);
    });

    map.on("click", e => {
      const f = map.queryRenderedFeatures(e.point, { layers: ["routes-hit"] });
      if (!f.length && isolatedUid) {
        isolatedUid = null;
        applyIsolation();
      }
    });
  }

  fitToBoundsFromGeoms(currentRoutes.map(r => r.geom));
}

// =====================================================
// INIT
// =====================================================
map.on("load", async () => {
  selected.years.add("2025");
  selected.types.add("Flight");
  await loadRoutes();
});

reloadBtn?.addEventListener("click", loadRoutes);

sidebarToggle?.addEventListener("click", () => {
  sidebar.classList.toggle("collapsed");
  setTimeout(() => map.resize(), 250);
});

