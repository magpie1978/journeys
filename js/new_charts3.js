/* global Chart, sb */

/*
  FIXES INCLUDED
  -------------
  ✅ Right-hand chart:
     - Scrollbar is permanent (overflowY: scroll)
     - Only ~top 20 airlines visible at once (configurable)
     - Airlines sorted by total flights (DESC)
     - Chart fills the allocated panel width
     - Canvas height is "tall" (all airlines) so scrolling happens in parent
     - Bars are stacked by YEAR (all segments same yellow + thin border between segments)

  ✅ Bottom-left chart:
     - Restored + always rendered
     - Uses ALL airlines so yearly totals match the top-left chart
     - Stacked by airline (same yellow + thin borders)

  ✅ Prevent “cut off” axes:
     - Adds chart layout padding (bottom/left/right)
*/

//
// -----------------------------------------------------
// GLOBAL FONT LOCK
// -----------------------------------------------------
Chart.defaults.font.family =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
Chart.defaults.font.size = 12;
Chart.defaults.font.weight = "400";
Chart.defaults.color = "#ccc";

//
// -----------------------------------------------------
// GLOBAL STATE
// -----------------------------------------------------
let baseStatsData = [];
let viewMode = "year"; // "year" | "alltime"

let yearChart = null;             // top-left
let airlineStackedChart = null;   // bottom-left
let airlineByYearChart = null;    // right

//
// -----------------------------------------------------
// CONFIG
// -----------------------------------------------------
const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";

const RIGHT_ROW_HEIGHT = 32;
const RIGHT_VISIBLE_ROWS = 24;



//
// -----------------------------------------------------
// ADD END LABEL PLUGIN
// -----------------------------------------------------

const barEndLabelPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#ccc";
    ctx.textBaseline = "middle";

    // Loop over each airline (y-axis label)
    chart.data.labels.forEach((label, index) => {
      let total = 0;

      // Sum stacked datasets for this row
      chart.data.datasets.forEach(ds => {
        const value = ds.data[index];
        if (typeof value === "number") total += value;
      });

      if (total > 0) {
        const x = xScale.getPixelForValue(total) + 6; // offset right
        const y = yScale.getPixelForTick(index);

        ctx.fillText(total, x, y);
      }
    });

    ctx.restore();
  }
};




//
// -----------------------------------------------------
// LOAD BASE DATA
// -----------------------------------------------------
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

function year4(v) {
  if (v == null) return null;
  const y = String(v).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

//
// -----------------------------------------------------
// AGGREGATORS
// -----------------------------------------------------
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

// Bottom-left: map[year][airline] = count, datasets = airlines, labels = years
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

  // Keep ALL airlines so totals match the top chart, but sort by overall flights (DESC)
  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  const datasets = airlines.map(airline => ({
    label: airline,
    data: years.map(y => map[y]?.[airline] || 0),
  }));

  return { years, datasets };
}

// Right: stacked horizontal, map[airline][year] = count, datasets = years, labels = airlines
function flightsPerAirlineByYear(data) {
  const map = {};
  const airlineTotals = {};
  const yearsSet = new Set();

  (data || []).forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    if (!y) return;

    yearsSet.add(y);

    map[r.airline] ??= {};
    map[r.airline][y] = (map[r.airline][y] || 0) + 1;

    airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
  });

  const years = Array.from(yearsSet).sort();

  // Airlines sorted by TOTAL flights (DESC)
  const airlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([airline]) => airline);

  // datasets = years (stacked), labels = airlines
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

//
// -----------------------------------------------------
// RENDERERS
// -----------------------------------------------------
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
      layout: { padding: { top: 6, right: 10, bottom: 16, left: 10 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (metric === "miles") return `${Number(v).toLocaleString()} miles`;
              return `${Number(v).toLocaleString()}`;
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
        // Force same look for all stacks
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1,
        borderSkipped: false,
        barPercentage: 0.75,
        categoryPercentage: 0.85,
        stack: "airlines",
      })),
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

function renderRight({ airlines, datasets }) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  // parent is your .airline-scroll div
  const container = canvas.parentElement;

  // Make scrollbar permanent + lock visible height to ~20 rows
  const visibleHeight = RIGHT_VISIBLE_ROWS * RIGHT_ROW_HEIGHT;
  container.style.height = `${visibleHeight}px`;
  container.style.maxHeight = `${visibleHeight}px`;
  container.style.overflowY = "scroll"; // permanent
  container.style.overflowX = "hidden";
  container.style.position = "relative";

  // Canvas is tall (all airlines) so container scrolls
  const totalHeight = (airlines?.length || 0) * RIGHT_ROW_HEIGHT;
  canvas.height = Math.max(totalHeight, visibleHeight);
  canvas.style.height = `${Math.max(totalHeight, visibleHeight)}px`;
  canvas.style.width = "100%";

  // Ensure canvas drawing width matches container width
  // (important because we set responsive:false)
  const w = container.clientWidth || 800;
  canvas.width = w;

  if (airlineByYearChart) airlineByYearChart.destroy();

  airlineByYearChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
  
    data: {
      labels: airlines,
      datasets // already styled in flightsPerAirlineByYear()
    },
  
    options: {
      indexAxis: "y",
      responsive: false,
      maintainAspectRatio: false,

      scales: {
        x: {
          stacked: true,
          grid: {
            display: true,
            color: "rgba(255,255,255,0.08)", // faint vertical lines
            lineWidth: 1,
            drawBorder: false
          },
          ticks: {
            font: { size: 11 }
          }
        },
        y: {
          stacked: true,
          grid: {
            display: false // keep rows clean
          },
          ticks: {
            autoSkip: false,
            font: { size: 11 },
            padding: 8
          }
        }
      },
  
      datasets: {
        bar: {
          categoryPercentage: 1.0, // fill vertical space
          barPercentage: 0.9
        }
      },
  
      plugins: {
        legend: { display: false },
        barEndLabels: true
      }
    },
    plugins: [barEndLabelPlugin]
  });




  
    // Reset scroll to top so user sees “top 20” initially
    container.scrollTop = 0;
  }

//
// -----------------------------------------------------
// METRIC DISPATCH (top-left only)
// -----------------------------------------------------
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

//
// -----------------------------------------------------
// INIT + EVENTS
// -----------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const metricSelect = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");

  // Initial render (all three charts)
  renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
  renderBottomLeft(flightsPerYearPerAirline(baseStatsData));
  renderRight(flightsPerAirlineByYear(baseStatsData));

  // Re-render top-left when metric changes
  metricSelect.addEventListener("change", () => {
    renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
  });

  // Toggle year/alltime (top-left only)
  btnYear.addEventListener("click", () => {
    viewMode = "year";
    btnYear.classList.add("active");
    btnAllTime.classList.remove("active");
    renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
  });

  btnAllTime.addEventListener("click", () => {
    viewMode = "alltime";
    btnAllTime.classList.add("active");
    btnYear.classList.remove("active");
    renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
  });

  // If the right panel is resized (responsive layout), rebuild the right chart width
  window.addEventListener("resize", () => {
    // Only need to re-render right (width is manual)
    renderRight(flightsPerAirlineByYear(baseStatsData));
  });
});
