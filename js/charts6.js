/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineYearChart = null;
let baseStatsData = [];
let viewMode = "year"; // "year" | "alltime"

// =====================================================
// GLOBAL FONT LOCK
// =====================================================
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = "400";
Chart.defaults.color = "#ccc";

// =====================================================
// LOAD BASE DATA
// =====================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline, destination_country");

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }
  return data || [];
}

// =====================================================
// YEAR NORMALISATION
// =====================================================
function yearKey(r) {
  if (!r?.year) return null;
  return String(r.year).slice(0, 4);
}

// =====================================================
// TOP-LEFT AGGREGATORS
// =====================================================
function flightsPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = yearKey(r);
    if (!y) return;
    out[y] = (out[y] || 0) + 1;
  });
  return out;
}

function milesPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = yearKey(r);
    if (!y) return;
    out[y] = (out[y] || 0) + (r.journey_distance || 0);
  });
  return out;
}

function airlinesPerYear(data) {
  const map = {};
  data.filter(r => r.journey_type === "Flight" && r.airline).forEach(r => {
    const y = yearKey(r);
    if (!y) return;
    map[y] ??= new Set();
    map[y].add(r.airline);
  });
  return Object.fromEntries(
    Object.entries(map).map(([y, set]) => [y, set.size])
  );
}

function countriesPerYear(data) {
  const map = {};
  data.filter(r => r.journey_type === "Flight" && r.destination_country)
    .forEach(r => {
      const y = yearKey(r);
      if (!y) return;
      map[y] ??= new Set();
      map[y].add(r.destination_country);
    });
  return Object.fromEntries(
    Object.entries(map).map(([y, set]) => [y, set.size])
  );
}

// =====================================================
// CUMULATIVE
// =====================================================
function cumulative(valuesByYear) {
  let running = 0;
  const out = {};
  Object.keys(valuesByYear).sort().forEach(y => {
    running += valuesByYear[y];
    out[y] = running;
  });
  return out;
}

// =====================================================
// TOP-LEFT RENDERER
// =====================================================
function renderYearChart(values, metric) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  if (yearChart) yearChart.destroy();

  yearChart = new Chart(canvas.getContext("2d"), {
    type: viewMode === "alltime" ? "line" : "bar",
    data: {
      labels: Object.keys(values).sort(),
      datasets: [{
        data: Object.keys(values).sort().map(y => values[y]),
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: viewMode === "alltime" ? 3 : 0,
        tension: 0.3,
        pointRadius: viewMode === "alltime" ? 3 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(255,255,255,0.08)" } }
      }
    }
  });
}

// =====================================================
// RIGHT-HAND AGGREGATORS
// =====================================================
function flightsPerAirlinePerYear(data) {
  const map = {};
  const totals = {};

  data.filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const y = yearKey(r);
      if (!y) return;

      map[r.airline] ??= {};
      map[r.airline][y] = (map[r.airline][y] || 0) + 1;
      totals[r.airline] = (totals[r.airline] || 0) + 1;
    });

  return buildAirlineDatasets(map, totals);
}

// =====================================================
// DATASET BUILDER
// =====================================================
function buildAirlineDatasets(map, totals) {
  const airlines = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);

  const years = [...new Set(
    Object.values(map).flatMap(o => Object.keys(o))
  )].sort();

  return {
    airlines,
    datasets: years.map((year, i) => ({
      label: year,
      data: airlines.map(a => map[a]?.[year] || 0),
      backgroundColor: "rgba(201,162,77,0.7)",
      borderRadius: i === years.length - 1 ? { topRight: 6, bottomRight: 6 } : 0
    }))
  };
}

// =====================================================
// RIGHT-HAND RENDERER (SCROLLABLE)
// =====================================================
function renderAirlineChart(data) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const ROW_HEIGHT = 36;
  canvas.height = data.airlines.length * ROW_HEIGHT;
  canvas.style.height = `${canvas.height}px`;

  if (airlineYearChart) airlineYearChart.destroy();

  airlineYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.airlines,
      datasets: data.datasets
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, autoSkip: false }
      },
      plugins: { legend: { display: false } }
    }
  });
}

// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const metricSelect = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");

  function refreshTop() {
    let values;
    switch (metricSelect.value) {
      case "miles": values = milesPerYear(baseStatsData); break;
      case "airlines": values = airlinesPerYear(baseStatsData); break;
      case "countries": values = countriesPerYear(baseStatsData); break;
      default: values = flightsPerYear(baseStatsData);
    }
    if (viewMode === "alltime") values = cumulative(values);
    renderYearChart(values, metricSelect.value);
  }

  renderAirlineChart(flightsPerAirlinePerYear(baseStatsData));
  refreshTop();

  metricSelect.addEventListener("change", refreshTop);
  btnYear.onclick = () => { viewMode = "year"; refreshTop(); };
  btnAllTime.onclick = () => { viewMode = "alltime"; refreshTop(); };
});
