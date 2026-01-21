/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
let airlineYearStackedChart = null;     // bottom-left
let airlineYearHorizontalChart = null;  // right-hand

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

function airlinesPerYearSets(data) {
  const map = {};
  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      map[y] ??= new Set();
      map[y].add(r.airline);
    });
  return map;
}

function countriesPerYearSets(data) {
  const map = {};
  data
    .filter(r => r.journey_type === "Flight" && r.destination_country)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      map[y] ??= new Set();
      map[y].add(r.destination_country);
    });
  return map;
}

function cumulative(valuesByYear) {
  let running = 0;
  const out = {};
  Object.keys(valuesByYear)
    .sort()
    .forEach(y => {
      running += valuesByYear[y];
      out[y] = running;
    });
  return out;
}

function cumulativeDistinctSets(perYearSets) {
  const seen = new Set();
  const out = {};
  Object.keys(perYearSets)
    .sort()
    .forEach(year => {
      perYearSets[year].forEach(v => seen.add(v));
      out[year] = seen.size;
    });
  return out;
}

// =====================================================
// FLIGHTS PER YEAR PER AIRLINE (BOTTOM LEFT)
// =====================================================
function flightsPerYearPerAirline(data) {
  const map = {};
  const airlineTotals = {};

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const year = String(r.year).slice(0, 4);

      map[year] ??= {};
      map[year][r.airline] = (map[year][r.airline] || 0) + 1;

      airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
    });

  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const years = Object.keys(map).sort();

  const datasets = airlines.map(airline => ({
    label: airline,
    data: years.map(y => map[y]?.[airline] || 0),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderColor: "rgba(201,162,77,0.9)",
    borderWidth: 1,
    borderRadius: 4,
  }));

  return { years, datasets };
}

// =====================================================
// FLIGHTS PER AIRLINE BY YEAR (RIGHT HAND – SCROLLABLE)
// =====================================================
function flightsPerAirlinePerYear(data) {
  const map = {};
  const airlineTotals = {};

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
      const year = String(r.year).slice(0, 4);

      map[r.airline] ??= {};
      map[r.airline][year] = (map[r.airline][year] || 0) + 1;

      airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
    });

  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const years = [
    ...new Set(
      Object.values(map).flatMap(obj => Object.keys(obj))
    ),
  ].sort();

  const datasets = years.map(year => ({
    label: year,
    data: airlines.map(a => map[a]?.[year] || 0),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderColor: "rgba(201,162,77,0.9)",
    borderWidth: 1,
  }));

  return { airlines, years, datasets };
}

// =====================================================
// RENDERERS
// =====================================================
function renderYearChart(values, metric) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Object.keys(values).sort();
  const data = labels.map(y => Math.round(values[y]));

  if (yearChart) yearChart.destroy();

  yearChart = new Chart(ctx, {
    type: viewMode === "alltime" ? "line" : "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: viewMode === "alltime" ? 3 : 0,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: "rgba(255,255,255,0.08)" } },
      },
    },
  });
}

function renderFlightsPerYearPerAirline(data) {
  const canvas = document.getElementById("flightsPerYearAirlineChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (airlineYearStackedChart) {
    airlineYearStackedChart.destroy();
  }

  airlineYearStackedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.years,
      datasets: data.datasets.map(ds => ({
        ...ds,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

function renderFlightsPerAirlineByYear(data) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const ROW_HEIGHT = 28;
  const VISIBLE_ROWS = 20;

  const totalHeight = data.airlines.length * ROW_HEIGHT;
  const visibleHeight = VISIBLE_ROWS * ROW_HEIGHT;

  const scroll = canvas.parentElement;

  // 👇 CRITICAL layout fixes
  scroll.style.flex = "1";
  scroll.style.minHeight = "0";
  scroll.style.overflowY = "auto";
  scroll.style.overflowX = "hidden";

  canvas.height = totalHeight;
  canvas.style.height = `${totalHeight}px`;
  canvas.style.width = "100%";

  const ctx = canvas.getContext("2d");

  if (airlineYearHorizontalChart) {
    airlineYearHorizontalChart.destroy();
  }

  airlineYearHorizontalChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.airlines,
      datasets: data.datasets,
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          stacked: true,
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          stacked: true,
          ticks: { autoSkip: false },
          grid: { display: false },
        },
      },
    },
  });
}

// =====================================================
// METRIC DISPATCH
// =====================================================
function getMetricValues(metric) {
  switch (metric) {
    case "miles":
      return viewMode === "alltime"
        ? cumulative(milesPerYear(baseStatsData))
        : milesPerYear(baseStatsData);

    case "airlines": {
      const s = airlinesPerYearSets(baseStatsData);
      return viewMode === "alltime"
        ? cumulativeDistinctSets(s)
        : Object.fromEntries(Object.entries(s).map(([y, set]) => [y, set.size]));
    }

    case "countries": {
      const s = countriesPerYearSets(baseStatsData);
      return viewMode === "alltime"
        ? cumulativeDistinctSets(s)
        : Object.fromEntries(Object.entries(s).map(([y, set]) => [y, set.size]));
    }

    default:
      return viewMode === "alltime"
        ? cumulative(flightsPerYear(baseStatsData))
        : flightsPerYear(baseStatsData);
  }
}

// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const metricSelect = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");

  renderYearChart(getMetricValues("flights"), "flights");

  renderFlightsPerYearPerAirline(
    flightsPerYearPerAirline(baseStatsData)
  );

  renderFlightsPerAirlineByYear(
    flightsPerAirlinePerYear(baseStatsData)
  );

  metricSelect.addEventListener("change", () =>
    renderYearChart(getMetricValues(metricSelect.value), metricSelect.value)
  );

  btnYear.onclick = () => {
    viewMode = "year";
    btnYear.classList.add("active");
    btnAllTime.classList.remove("active");
    renderYearChart(getMetricValues(metricSelect.value), metricSelect.value);
  };

  btnAllTime.onclick = () => {
    viewMode = "alltime";
    btnAllTime.classList.add("active");
    btnYear.classList.remove("active");
    renderYearChart(getMetricValues(metricSelect.value), metricSelect.value);
  };
});
