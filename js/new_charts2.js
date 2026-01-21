/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineStackedChart = null;
let airlineHorizontalChart = null;
let baseStatsData = [];
let viewMode = "year"; // "year" | "alltime"

// -----------------------------------------------------
// GLOBAL FONT LOCK
// -----------------------------------------------------
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
    .from("journeys_routes_core_mv")
    .select("year, journey_type, journey_distance, airline, destination_country");

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }
  return data || [];
}

// =====================================================
// AGGREGATORS
// =====================================================
function flightsPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = String(r.year).slice(0, 4);
    out[y] = (out[y] || 0) + 1;
  });
  return out;
}

function milesPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = String(r.year).slice(0, 4);
    out[y] = (out[y] || 0) + (r.journey_distance || 0);
  });
  return out;
}

function flightsPerYearPerAirline(data) {
  const map = {};
  const airlineTotals = {};

  data.filter(r => r.journey_type === "Flight" && r.airline).forEach(r => {
    const year = String(r.year).slice(0, 4);
    map[year] ??= {};
    map[year][r.airline] = (map[year][r.airline] || 0) + 1;
    airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
  });

  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([a]) => a);

  const years = Object.keys(map).sort();

  const datasets = airlines.map(a => ({
    label: a,
    data: years.map(y => map[y]?.[a] || 0),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderColor: "rgba(201,162,77,0.9)",
    borderWidth: 1,
    borderSkipped: false
  }));

  return { years, datasets };
}

function flightsPerAirlineTotals(data) {
  const totals = {};
  data.filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      totals[r.airline] = (totals[r.airline] || 0) + 1;
    });

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1]);
}

// =====================================================
// CHART RENDERERS
// =====================================================
function renderYearChart(values, metric) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  if (yearChart) yearChart.destroy();

  const labels = Object.keys(values).sort();
  const data = labels.map(y => values[y]);

  yearChart = new Chart(canvas.getContext("2d"), {
    type: viewMode === "alltime" ? "line" : "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: viewMode === "alltime" ? 3 : 0,
        borderRadius: 6,
        tension: 0.3
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

function renderFlightsPerYearPerAirline(data) {
  const canvas = document.getElementById("flightsPerYearAirlineChart");
  if (!canvas) return;

  if (airlineStackedChart) airlineStackedChart.destroy();

  airlineStackedChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.years,
      datasets: data.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, grid: { color: "rgba(255,255,255,0.08)" } }
      }
    }
  });
}

function renderFlightsPerAirlineByYear(data) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const ROW_HEIGHT = 28;
  const VISIBLE_ROWS = 20;

  const totalHeight = data.airlines.length * ROW_HEIGHT;
  const visibleHeight = VISIBLE_ROWS * ROW_HEIGHT;

  canvas.height = totalHeight;
  canvas.style.height = `${totalHeight}px`;

  const container = canvas.parentElement;
  container.style.height = `${visibleHeight}px`;
  container.style.overflowY = "auto";

  if (airlineHorizontalChart) airlineHorizontalChart.destroy();

  airlineHorizontalChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.airlines,
      datasets: [{
        data: data.totals,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: 1,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { autoSkip: false }, grid: { display: false } }
      }
    }
  });
}

// =====================================================
// METRIC DISPATCH
// =====================================================
function getMetricValues(metric) {
  let yearly;

  switch (metric) {
    case "miles":
      yearly = milesPerYear(baseStatsData);
      break;
    default:
      yearly = flightsPerYear(baseStatsData);
  }

  if (viewMode === "alltime") {
    let run = 0;
    Object.keys(yearly).sort().forEach(y => {
      run += yearly[y];
      yearly[y] = run;
    });
  }

  return yearly;
}

// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const metricSelect = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");

  // Top-left
  renderYearChart(getMetricValues(metricSelect.value), metricSelect.value);

  // Bottom-left
  renderFlightsPerYearPerAirline(
    flightsPerYearPerAirline(baseStatsData)
  );

  // Right-hand
  const totals = flightsPerAirlineTotals(baseStatsData);
  renderFlightsPerAirlineByYear({
    airlines: totals.map(t => t[0]),
    totals: totals.map(t => t[1])
  });

  function refresh() {
    renderYearChart(getMetricValues(metricSelect.value), metricSelect.value);
  }

  metricSelect.addEventListener("change", refresh);

  btnYear.addEventListener("click", () => {
    viewMode = "year";
    btnYear.classList.add("active");
    btnAllTime.classList.remove("active");
    refresh();
  });

  btnAllTime.addEventListener("click", () => {
    viewMode = "alltime";
    btnAllTime.classList.add("active");
    btnYear.classList.remove("active");
    refresh();
  });
});
