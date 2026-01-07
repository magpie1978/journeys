/* global Chart, sb */

let baseStatsData = [];
let flightsChart = null;            // top-left
let flightsByAirlineChart = null;   // bottom-left

// =====================================================
// LOAD BASE DATA (one query total)
// =====================================================
async function loadStatsBaseDataOnce() {
  if (baseStatsData.length) return baseStatsData;

  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline, destination_country");

  if (error) {
    console.error("[stats] load failed", error);
    baseStatsData = [];
    return baseStatsData;
  }

  baseStatsData = data || [];
  return baseStatsData;
}

// =====================================================
// NORMALISATION HELPERS
// =====================================================
function normYear(v) {
  if (v == null) return null;
  const s = String(v);
  const y = s.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

function normaliseAirline(a) {
  if (!a) return "Unknown";
  return String(a)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")           // remove bracketed bits
    .replace(/\b(plc|ltd|limited)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// =====================================================
// METRICS
// =====================================================
function flightsPerYear(data) {
  const out = {};
  data.forEach(r => {
    if (r.journey_type !== "Flight") return;
    const y = normYear(r.year);
    if (!y) return;
    out[y] = (out[y] || 0) + 1;
  });
  return out;
}

function flightsPerYearPerAirline(data) {
  // map[year][airline] = count
  const map = {};
  const yearsSet = new Set();
  const airlinesSet = new Set();

  data.forEach(r => {
    if (r.journey_type !== "Flight") return;
    const y = normYear(r.year);
    if (!y) return;

    const airline = normaliseAirline(r.airline);
    yearsSet.add(y);
    airlinesSet.add(airline);

    if (!map[y]) map[y] = {};
    map[y][airline] = (map[y][airline] || 0) + 1;
  });

  const years = Array.from(yearsSet).sort();
  const airlines = Array.from(airlinesSet).sort();

  // ✅ datasets = airlines, labels = years (stacked)
  const datasets = airlines.map(airline => ({
    label: airline,
    data: years.map(y => map[y]?.[airline] || 0),
    stack: "airlines",
  }));

  return { years, datasets };
}

// =====================================================
// RENDERERS
// =====================================================
function renderFlightsByYear(values) {
  const ctx = document.getElementById("flightsByYearChart")?.getContext("2d");
  if (!ctx) return;

  if (flightsChart) flightsChart.destroy();

  const years = Object.keys(values).sort();
  const data = years.map(y => values[y]);

  flightsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [{
        label: "Flights",
        data,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#ccc" } },
        y: { grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#ccc" } },
      },
    },
  });
}

function renderFlightsPerYearPerAirline(years, datasets) {
  const ctx = document.getElementById("flightsPerYearAirlineChart")?.getContext("2d");
  if (!ctx) return;

  if (flightsByAirlineChart) flightsByAirlineChart.destroy();

  flightsByAirlineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: datasets.map(ds => ({
        ...ds,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, ticks: { color: "#ccc" } },
        y: { stacked: true, ticks: { color: "#ccc" } },
      },
    },
  });
}



// =====================================================
// MAIN UPDATE (one source of truth)
// =====================================================
const metricSelect = document.getElementById("metricSelector"); // ✅ matches stats.html

async function update() {
  const data = await loadStatsBaseDataOnce();
  const metric = metricSelect?.value || "flights";

  // Always run the consistency check for 2017 while debugging
  debugYearMismatch(data, "2017");

  if (metric === "flights") {
    const byYear = flightsPerYear(data);
    renderFlightsByYear(byYear);

    const { years, datasets } = flightsPerYearPerAirline(data);
    renderFlightsPerYearPerAirline(years, datasets);
  }

  // (If you later want miles/countries/airlines metrics back, we can add them here)
}

document.addEventListener("DOMContentLoaded", update);
metricSelect?.addEventListener("change", update);
