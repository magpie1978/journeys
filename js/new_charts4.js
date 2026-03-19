/* global Chart, sb */

// ============================================================================
// GLOBAL CHART.JS DEFAULTS (consistent styling across charts)
// ============================================================================
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = "400";
Chart.defaults.color = "#ccc";

// ============================================================================
// GLOBAL STATE
// ============================================================================
let baseStatsData = [];
let viewMode = "year"; // "year" | "alltime"

let yearChart = null;            // top-left
let airlineStackedChart = null;  // bottom-left
let airlineByYearChart = null;   // right panel (Flights/Miles toggle)
let countryChart = null;         // visits per country

let currentAirlineMetric = "flights"; // "flights" | "miles"

// ============================================================================
// VISUAL CONSTANTS
// ============================================================================
const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";

// Right panel scroll sizing
const RIGHT_ROW_HEIGHT = 32;
const RIGHT_VISIBLE_ROWS = 24;

// Country chart scroll sizing
const COUNTRY_ROW_HEIGHT = 30;
const COUNTRY_VISIBLE_ROWS = 20;

// ============================================================================
// HELPERS
// ============================================================================
function year4(v) {
  if (v == null) return null;
  const y = String(v).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

function numberFmt(n) {
  return Number(n || 0).toLocaleString();
}

// ============================================================================
// PLUGIN: End-of-bar totals for stacked horizontal bars (right panel)
// ============================================================================
const barEndLabelPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart, args, pluginOptions) {
    const { ctx, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    // only for horizontal bar charts
    if (!xScale || !yScale) return;

    const metric = pluginOptions?.metric || "flights";

    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#ccc";
    ctx.textBaseline = "middle";

    chart.data.labels.forEach((label, i) => {
      let total = 0;
      chart.data.datasets.forEach(ds => {
        const v = ds.data?.[i];
        if (typeof v === "number") total += v;
      });
      if (total <= 0) return;

      const x = xScale.getPixelForValue(total) + 8;
      const y = yScale.getPixelForTick(i);

      const text =
        metric === "miles" ? numberFmt(Math.round(total)) : numberFmt(total);

      ctx.fillText(text, x, y);
    });

    ctx.restore();
  }
};

// ============================================================================
// LOAD BASE DATA (Supabase)
// ============================================================================
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

// ============================================================================
// AGGREGATORS
// ============================================================================
function flightsPerYear(data) {
  const out = {};
  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    const y = year4(r.year);
    if (!y) return;
    out[y] = (out[y] || 0) + 1;
  });
  return out;
}

function milesPerYear(data) {
  const out = {};
  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    const y = year4(r.year);
    if (!y) return;
    out[y] = (out[y] || 0) + (Number(r.journey_distance) || 0);
  });
  return out;
}

function cumulative(valuesByYear) {
  const out = {};
  let run = 0;
  Object.keys(valuesByYear)
    .sort()
    .forEach(y => {
      run += valuesByYear[y];
      out[y] = run;
    });
  return out;
}

// Bottom-left: Flights per YEAR per AIRLINE (stacked by airline)
function flightsPerYearPerAirline(data) {
  const map = {};
  const airlineTotals = {};

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    map[y] ??= {};
    map[y][r.airline] = (map[y][r.airline] || 0) + 1;

    airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
  });

  const years = Object.keys(map).sort();

  // keep all airlines but sort by total desc (so consistent stacking order)
  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const datasets = airlines.map(airline => ({
    label: airline,
    data: years.map(y => map[y]?.[airline] || 0),
  }));

  return { years, datasets };
}

// Right panel: Airline metric by YEAR (stacked by year)
function metricPerAirlineByYear(data, metric = "flights") {
  const map = {};
  const airlineTotals = {};
  const yearsSet = new Set();

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    yearsSet.add(y);

    const val = metric === "miles" ? (Number(r.journey_distance) || 0) : 1;

    map[r.airline] ??= {};
    map[r.airline][y] = (map[r.airline][y] || 0) + val;

    airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + val;
  });

  const years = Array.from(yearsSet).sort();

  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const datasets = years.map(y => ({
    label: y,
    data: airlines.map(a => map[a]?.[y] || 0),
    backgroundColor: YELLOW,
    borderColor: YELLOW_BORDER,
    borderWidth: 1,
    borderSkipped: false,
    stack: "years",
  }));

  return { airlines, years, datasets };
}

// Visits per Country (exclude UK)
function visitsPerCountry(data) {
  const counts = {};

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.destination_country) return;
    if (r.destination_country === "United Kingdom") return;

    const c = r.destination_country;
    counts[c] = (counts[c] || 0) + 1;
  });

  const countries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  return { countries, values: countries.map(c => counts[c]) };
}

// ============================================================================
// RENDERERS
// ============================================================================
function renderTopLeft(values, metric) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  if (yearChart) yearChart.destroy();

  const labels = Object.keys(values).sort();
  const data = labels.map(y => Math.round(values[y]));

  const isAllTime = viewMode === "alltime";

  yearChart = new Chart(canvas.getContext("2d"), {
    type: isAllTime ? "line" : "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          tension: 0.3,
          fill: false,
          backgroundColor: YELLOW,
          borderColor: YELLOW_BORDER,
          borderWidth: isAllTime ? 3 : 0,
          pointRadius: isAllTime ? 3 : 0,
          borderRadius: isAllTime ? 0 : 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      layout: { padding: { top: 6, right: 12, bottom: 24, left: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (metric === "miles") return `${numberFmt(v)} miles`;
              return `${numberFmt(v)}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: GRID }, ticks: { font: { size: 11 } } },
      },
    },
  });
}

function renderBottomLeft({ years, datasets }) {
  const canvas = document.getElementById("flightsPerYearAirlineChart");
  if (!canvas) return;

  if (airlineStackedChart) airlineStackedChart.destroy();

  airlineStackedChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: years,
      datasets: (datasets || []).map(ds => ({
        ...ds,
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1,
        borderSkipped: false,
        barPercentage: 0.85,
        categoryPercentage: 0.75,
        stack: "airlines",
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      layout: { padding: { top: 6, right: 12, bottom: 30, left: 12 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `Year ${items[0].label}`,
            label: ctx => `${ctx.dataset.label}: ${ctx.raw} flights`,
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { stacked: true, grid: { color: GRID }, ticks: { font: { size: 11 } } },
      },
    },
  });
}

function renderRight({ airlines, datasets }, metric) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  // Lock viewport height so only ~N rows show; scrollbar handles the rest
  const visibleHeight = RIGHT_VISIBLE_ROWS * RIGHT_ROW_HEIGHT;
  container.style.height = `${visibleHeight}px`;
  container.style.maxHeight = `${visibleHeight}px`;
  container.style.overflowY = "scroll"; // permanent
  container.style.overflowX = "hidden";
  container.style.position = "relative";

  // Make canvas tall so the container scrolls
  const totalHeight = (airlines?.length || 0) * RIGHT_ROW_HEIGHT;
  const finalHeight = Math.max(totalHeight, visibleHeight);

  canvas.height = finalHeight;
  canvas.style.height = `${finalHeight}px`;
  canvas.style.width = "100%";

  // Because responsive:false, explicitly size the drawing buffer width
  const w = container.clientWidth || 800;
  canvas.width = w;

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: airlines,
      datasets,
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 8, right: 36, bottom: 8, left: 8 } }, // right padding for end labels
      scales: {
        x: {
          stacked: true,
          grid: {
            display: true,
            color: GRID, // faint vertical lines
            lineWidth: 1,
            drawBorder: false,
          },
          ticks: {
            font: { size: 11 },
            callback: v =>
              metric === "miles" ? numberFmt(Math.round(v)) : v,
          },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: {
            autoSkip: false,
            font: { size: 11 },
            padding: 8,
          },
        },
      },
      datasets: {
        bar: {
          categoryPercentage: 0.92, // slightly more space between bars
          barPercentage: 0.85,
        },
      },
      plugins: {
        legend: { display: false },
        barEndLabels: { metric }, // plugin options
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return metric === "miles"
                ? `${ctx.dataset.label}: ${numberFmt(Math.round(v))} miles`
                : `${ctx.dataset.label}: ${numberFmt(v)} flights`;
            },
          },
        },
      },
    },
    plugins: [barEndLabelPlugin],
  });

  // ensure initial view shows the "top chunk"
  container.scrollTop = 0;
}

function renderVisitsPerCountry({ countries, values }) {
  const canvas = document.getElementById("visitsPerCountryChart");
  if (!canvas) return;

  const container = canvas.parentElement;
  if (!container) return;

  const visibleHeight = COUNTRY_VISIBLE_ROWS * COUNTRY_ROW_HEIGHT;
  container.style.height = `${visibleHeight}px`;
  container.style.maxHeight = `${visibleHeight}px`;
  container.style.overflowY = "scroll";
  container.style.overflowX = "hidden";

  const totalHeight = (countries?.length || 0) * COUNTRY_ROW_HEIGHT;
  const finalHeight = Math.max(totalHeight, visibleHeight);

  canvas.height = finalHeight;
  canvas.style.height = `${finalHeight}px`;
  canvas.style.width = "100%";

  // responsive:false => set width buffer
  //const w = container.clientWidth || 600;
  const w = container.offsetWidth || 600;
  canvas.width = w;

  if (countryChart) countryChart.destroy();

  countryChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: countries,
      datasets: [
        {
          data: values,
          backgroundColor: YELLOW,
          borderColor: YELLOW_BORDER,
          borderWidth: 1,
          barPercentage: 0.85,
          categoryPercentage: 0.92,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { top: 8, right: 12, bottom: 8, left: 8 } },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: GRID }, ticks: { precision: 0 } },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
    },
  });

  container.scrollTop = 0;
}

// ============================================================================
// TOP-LEFT METRIC DISPATCH
// ============================================================================
function getTopLeftValues(metric) {
  let yearly;
  switch (metric) {
    case "miles":
      yearly = milesPerYear(baseStatsData);
      return viewMode === "alltime" ? cumulative(yearly) : yearly;
    case "flights":
    default:
      yearly = flightsPerYear(baseStatsData);
      return viewMode === "alltime" ? cumulative(yearly) : yearly;
  }
}

// ============================================================================
// INIT
// ============================================================================
//document.addEventListener("DOMContentLoaded", async () => {
//  baseStatsData = await loadStatsBaseData();

//  const metricSelector = document.getElementById("metricSelector");
//  const btnYear = document.getElementById("btnYear");
//  const btnAllTime = document.getElementById("btnAllTime");
//  const airlineMetricSelect = document.getElementById("airlineMetricSelect");

  // initial render
//  if (metricSelector) {
//    renderTopLeft(getTopLeftValues(metricSelector.value), metricSelector.value);
//  } else {
//    renderTopLeft(getTopLeftValues("flights"), "flights");
//  }

//  renderBottomLeft(flightsPerYearPerAirline(baseStatsData));
//  renderVisitsPerCountry(visitsPerCountry(baseStatsData));

  // right panel uses its own dropdown (Flights/Miles)
//  const initialMetric = airlineMetricSelect?.value || "flights";
//  currentAirlineMetric = initialMetric;
//  renderRight(metricPerAirlineByYear(baseStatsData, currentAirlineMetric), currentAirlineMetric);

  // events: top-left metric change
//  metricSelector?.addEventListener("change", () => {
//    renderTopLeft(getTopLeftValues(metricSelector.value), metricSelector.value);
//  });

  // events: year/alltime toggle (top-left only)
//  btnYear?.addEventListener("click", () => {
//    viewMode = "year";
//    btnYear.classList.add("active");
//    btnAllTime?.classList.remove("active");
//    const m = metricSelector?.value || "flights";
//    renderTopLeft(getTopLeftValues(m), m);
//  });

//  btnAllTime?.addEventListener("click", () => {
//    viewMode = "alltime";
//    btnAllTime.classList.add("active");
//    btnYear?.classList.remove("active");
//    const m = metricSelector?.value || "flights";
//    renderTopLeft(getTopLeftValues(m), m);
//  });

  // events: right panel dropdown (Flights/Miles)
//  airlineMetricSelect?.addEventListener("change", e => {
//    currentAirlineMetric = e.target.value;
//    renderRight(
//      metricPerAirlineByYear(baseStatsData, currentAirlineMetric),
//      currentAirlineMetric
//    );
//  });

  // resize: re-render right + country (because responsive:false uses manual widths)
//  window.addEventListener("resize", () => {
//    renderRight(
//      metricPerAirlineByYear(baseStatsData, currentAirlineMetric),
//      currentAirlineMetric
//    );
//    renderVisitsPerCountry(visitsPerCountry(baseStatsData));
//  }); 


const page = window.location.pathname;

baseStatsData = await loadStatsBaseData();

// 🔹 Flights page
if (document.getElementById("flightsByYearChart")) {
  const metricSelector = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");

  const metric = metricSelector?.value || "flights";
  renderTopLeft(getTopLeftValues(metric), metric);

  metricSelector?.addEventListener("change", () => {
    renderTopLeft(getTopLeftValues(metricSelector.value), metricSelector.value);
  });

  btnYear?.addEventListener("click", () => {
    viewMode = "year";
    renderTopLeft(getTopLeftValues(metricSelector.value), metricSelector.value);
  });

  btnAllTime?.addEventListener("click", () => {
    viewMode = "alltime";
    renderTopLeft(getTopLeftValues(metricSelector.value), metricSelector.value);
  });
}

// 🔹 Flights per airline
if (document.getElementById("flightsPerYearAirlineChart")) {
  renderBottomLeft(flightsPerYearPerAirline(baseStatsData));
}

// 🔹 Airline by year
if (document.getElementById("flightsPerAirlineYearChart")) {
  const airlineMetricSelect = document.getElementById("airlineMetricSelect");
  const metric = airlineMetricSelect?.value || "flights";

  renderRight(
    metricPerAirlineByYear(baseStatsData, metric),
    metric
  );

  airlineMetricSelect?.addEventListener("change", e => {
    renderRight(
      metricPerAirlineByYear(baseStatsData, e.target.value),
      e.target.value
    );
  });
}

// 🔹 Countries
if (document.getElementById("visitsPerCountryChart")) {
  renderVisitsPerCountry(visitsPerCountry(baseStatsData));
}


});
