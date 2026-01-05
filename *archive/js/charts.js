/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineYearChart = null;
let baseStatsData = [];

// =====================================================
// LOAD BASE DATA
// =====================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select(
      "year, journey_type, journey_distance, airline, destination_country"
    );

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }

  return data || [];
}

// =====================================================
// AGGREGATORS (TOP-LEFT)
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

function airlinesPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      if (!out[y]) out[y] = new Set();
      out[y].add(r.airline);
    });

  Object.keys(out).forEach(y => (out[y] = out[y].size));
  return out;
}

function countriesPerYear(data) {
  const out = {};
  data
    .filter(r => r.journey_type === "Flight" && r.destination_country)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      if (!out[y]) out[y] = new Set();
      out[y].add(r.destination_country);
    });

  Object.keys(out).forEach(y => (out[y] = out[y].size));
  return out;
}

// =====================================================
// AGGREGATORS (RIGHT-HAND SIDE)
// =====================================================
function perAirlinePerYear(data, metric = "flights") {
  const map = {};
  const yearsSet = new Set();

  data
    .filter(r => r.journey_type === "Flight" && r.airline && r.year)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      yearsSet.add(y);

      if (!map[r.airline]) map[r.airline] = {};
      map[r.airline][y] =
        (map[r.airline][y] || 0) +
        (metric === "miles" ? r.journey_distance || 0 : 1);
    });

  const years = [...yearsSet].sort();

  const airlines = Object.entries(map).map(([airline, yearsObj]) => ({
    airline,
    years: yearsObj,
    total: Object.values(yearsObj).reduce((a, b) => a + b, 0),
  }));

  airlines.sort((a, b) => b.total - a.total);

  return {
    years,
    airlines,
  };
}

// =====================================================
// CANVAS HEIGHT (SCROLL SUPPORT)
// =====================================================
function setAirlineCanvasHeight(canvas, airlineCount) {
  const ROW_HEIGHT = 34;      // thicker bars
  const VISIBLE_ROWS = 20;

  const visibleHeight = VISIBLE_ROWS * ROW_HEIGHT;
  const fullHeight = airlineCount * ROW_HEIGHT;

  canvas.style.height = `${fullHeight}px`;
}



// =====================================================
// TOP-LEFT CHART
// =====================================================
function renderYearChart(values, label) {
  const canvas = document.getElementById("flightsByYearChart");
  const title = document.getElementById("chartTitle");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const years = Object.keys(values).sort();
  const data = years.map(y => Math.round(values[y]));

  title.textContent = `${label} by Year`;

  if (yearChart) yearChart.destroy();

  yearChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          data,
          backgroundColor: "rgba(201,162,77,0.7)",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#ccc" }, grid: { display: false } },
        y: {
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

// =====================================================
// TOTAL LABEL PLUGIN (RIGHT-HAND)
// =====================================================
const airlineTotalsPlugin = {
  id: "airlineTotals",
  afterDatasetsDraw(chart, args, opts) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);

    ctx.save();
    ctx.fillStyle = "#ddd";
    ctx.font = "12px sans-serif";
    ctx.textBaseline = "middle";

    meta.data.forEach((bar, i) => {
      const total = opts.totals[i];
      if (!total) return;
      ctx.fillText(
        Math.round(total),
        bar.x + 8,
        bar.y
      );
    });

    ctx.restore();
  },
};

// =====================================================
// RIGHT-HAND CHART
// =====================================================
function renderAirlineChart(metric) {
  const canvas = document.getElementById("airlineYearChart");
  if (!canvas) return;

  // Destroy existing chart first
  if (airlineYearChart) {
    airlineYearChart.destroy();
    airlineYearChart = null;
  }

  // Build data ONCE
  const chartData = perAirlinePerYear(baseStatsData, metric);
  const allAirlines = chartData.airlines;

  // Resize canvas BEFORE rendering
  setAirlineCanvasHeight(canvas, allAirlines.length);

  // Force browser reflow so Chart.js sees correct height
  canvas.offsetHeight;

  const ctx = canvas.getContext("2d");

  const labels = allAirlines.map(a => a.airline);

  const datasets = chartData.years.map(year => ({
    data: allAirlines.map(a => a.years[year] || 0),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.35)",
    borderRadius: 4,
    barThickness: 24,        // thicker bars
    maxBarThickness: 28,
  }));

  airlineYearChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      indexAxis: "y",
      responsive: false,          // REQUIRED for scroll
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          stacked: true,
          ticks: { color: "#ccc" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        airlineTotals: {
          totals: allAirlines.map(a => a.total),
        },
      },
    },
    plugins: [airlineTotalsPlugin],
  });
}


// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  // Top-left default
  renderYearChart(flightsPerYear(baseStatsData), "Flights");

  document
    .getElementById("metricSelector")
    ?.addEventListener("change", e => {
      const v = e.target.value;
      if (v === "miles") renderYearChart(milesPerYear(baseStatsData), "Miles");
      else if (v === "airlines")
        renderYearChart(airlinesPerYear(baseStatsData), "Airlines");
      else if (v === "countries")
        renderYearChart(countriesPerYear(baseStatsData), "Countries");
      else renderYearChart(flightsPerYear(baseStatsData), "Flights");
    });

  // Right-hand default
  renderAirlineChart("flights");

  document
    .getElementById("airlineMetricSelector")
    ?.addEventListener("change", e => {
      renderAirlineChart(e.target.value);
    });
});
