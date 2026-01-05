/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineChart = null;
let baseStatsData = [];

// 👇 LOCK GLOBAL DEFAULT FONTS (IMPORTANT)
Chart.defaults.font.family = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 11;
Chart.defaults.color = "#ccc";

// =====================================================
// LOAD BASE DATA
// =====================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline");

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }
  return data || [];
}

// =====================================================
// AGGREGATORS — LEFT CHART
// =====================================================
function flightsPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + 1;
    });
  return out;
}

function milesPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + (r.journey_distance || 0);
    });
  return out;
}

// =====================================================
// AGGREGATORS — RIGHT CHART
// =====================================================
function flightsPerAirline(data) {
  const map = {};
  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      map[r.airline] = (map[r.airline] || 0) + 1;
    });

  return Object.entries(map)
    .map(([airline, total]) => ({ airline, total }))
    .sort((a, b) => b.total - a.total);
}

function milesPerAirline(data) {
  const map = {};
  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      map[r.airline] =
        (map[r.airline] || 0) + (r.journey_distance || 0);
    });

  return Object.entries(map)
    .map(([airline, total]) => ({ airline, total }))
    .sort((a, b) => b.total - a.total);
}

// =====================================================
// LEFT CHART RENDERER
// =====================================================
function renderYearChart(values) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Object.keys(values).sort();
  const data = labels.map(y => Math.round(values[y]));

  if (yearChart) yearChart.destroy();

  yearChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          ticks: { font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

// =====================================================
// RIGHT CHART RENDERER (SCROLLABLE, STABLE FONTS)
// =====================================================
function renderAirlineChart(data, metric) {
  const canvas = document.getElementById("airlineYearChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  const BAR_HEIGHT = 36;
  const VISIBLE_BARS = 20;

  // 👇 Fixed pixel height to force scroll
  canvas.height = data.length * BAR_HEIGHT;

  const labels = data.map(d => d.airline);
  const values = data.map(d => Math.round(d.total));

  if (airlineChart) airlineChart.destroy();

  airlineChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 6,
        barThickness: 22,
        maxBarThickness: 24,
        categoryPercentage: 0.9,
        barPercentage: 0.85,
      }],
    },
    options: {
      indexAxis: "y",

      // 🔑 DO NOT LET CHART.JS RESCALE FONTS
      responsive: false,
      maintainAspectRatio: false,
      animation: false,

      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: { size: 11 },
          bodyFont: { size: 11 },
          callbacks: {
            label: ctx =>
              metric === "miles"
                ? `${ctx.raw.toLocaleString()} miles`
                : `${ctx.raw} flights`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            font: { size: 11 },
          },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          ticks: {
            font: { size: 11 },
            padding: 14,
          },
          grid: { display: false },
        },
      },
    },
  });
}

// =====================================================
// INIT + DROPDOWNS
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  // LEFT DEFAULT
  renderYearChart(flightsPerYear(baseStatsData));

  // RIGHT DEFAULT
  renderAirlineChart(
    flightsPerAirline(baseStatsData),
    "flights"
  );

  // LEFT DROPDOWN
  document
    .getElementById("metricSelector")
    .addEventListener("change", e => {
      renderYearChart(
        e.target.value === "miles"
          ? milesPerYear(baseStatsData)
          : flightsPerYear(baseStatsData)
      );
    });

  // RIGHT DROPDOWN
  document
    .getElementById("airlineMetricSelector")
    .addEventListener("change", e => {
      const metric = e.target.value;
      renderAirlineChart(
        metric === "miles"
          ? milesPerAirline(baseStatsData)
          : flightsPerAirline(baseStatsData),
        metric
      );
    });
});
