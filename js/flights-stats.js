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
    //.from("journeys_routes_cache")
    .from("journeys_routes_cache_copy3")    
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


function renderFlightsPerAirlineByYear(airlines, datasets) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  // 🔴 CRITICAL FIXES
  const container = canvas.parentElement;

  canvas.height = Math.max(airlines.length * 36, 300);
  canvas.width  = container.clientWidth || 800; // 👈 THIS WAS MISSING

  const ctx = canvas.getContext("2d");

  if (window.flightsPerAirlineYearChart) {
    window.flightsPerAirlineYearChart.destroy();
  }

  window.flightsPerAirlineYearChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: airlines,
      datasets: datasets.map(ds => ({
        ...ds,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 4,
      })),
    },
    options: {
      indexAxis: "y",
      responsive: false,          // manual sizing
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#ccc", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          stacked: true,
          ticks: { color: "#ccc" },
          grid: { display: false },
        },
      },
    },
  });
}



// =====================================================
// HARD CHECK (this will tell us EXACTLY what’s missing)
// =====================================================
function debugYearMismatch(data, year = "2017") {
  const top = flightsPerYear(data)[year] || 0;

  const { years, datasets } = flightsPerYearPerAirline(data);
  const idx = years.indexOf(year);
  const bottom = idx === -1 ? 0 : datasets.reduce((sum, ds) => sum + (ds.data[idx] || 0), 0);

  if (top === bottom) {
    console.log(`[stats] OK: ${year} top=${top} bottom=${bottom}`);
    return;
  }

  console.warn(`[stats] MISMATCH in ${year}: top=${top} bottom=${bottom} (diff=${top - bottom})`);

  // Show all 2017 flight rows + the airline key they map to
  const rows2017 = data
    .filter(r => r.journey_type === "Flight" && normYear(r.year) === year)
    .map(r => ({
      year: normYear(r.year),
      airline_raw: r.airline,
      airline_norm: normaliseAirline(r.airline),
    }));

  console.table(rows2017);

  // Count by normalised airline
  const counts = rows2017.reduce((acc, r) => {
    acc[r.airline_norm] = (acc[r.airline_norm] || 0) + 1;
    return acc;
  }, {});
  console.table(counts);
}

// =====================================================
// MAIN UPDATE (one source of truth)
// =====================================================
const metricSelect = document.getElementById("metricSelector"); // ✅ matches stats.html

async function update() {
  const data = await loadStatsBaseDataOnce();
  const metric = metricSelect?.value || "flights";

  debugYearMismatch(data, "2017");

  if (metric !== "flights") return;

  // top-left
  renderFlightsByYear(flightsPerYear(data));

  // shared breakdown
  const { years, datasets } = flightsPerYearPerAirline(data);

  // bottom-left
  renderFlightsPerYearPerAirline(years, datasets);

  // right-hand (pivoted)
  renderFlightsPerAirlineByYear(
    datasets.map(d => d.label),          // airlines
    years.map((year, i) => ({
      label: year,
      data: datasets.map(d => d.data[i]),
      stack: "years",
    }))
  );
}


document.addEventListener("DOMContentLoaded", update);
metricSelect?.addEventListener("change", update);
