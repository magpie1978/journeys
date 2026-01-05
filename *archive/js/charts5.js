/* global Chart, sb */

// =====================================================
// GLOBAL STATE
// =====================================================
let yearChart = null;
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
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline, destination_country");

  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }
  return data || [];
}



// -----------------------------------------------------
// YEAR NORMALISATION HELPER
// -----------------------------------------------------
// Centralised helper to derive a consistent 4-digit year key from route records.
function yearKey(r) {
  if (!r?.year) return null;
  return String(r.year).slice(0, 4);
}





function flightsPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years
      out[y] = (out[y] || 0) + 1;
    });
  return out;
}



function milesPerYear(data) {
  const out = {};
  data.filter(r => r.journey_type === "Flight").forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years
    out[y] = (out[y] || 0) + (r.journey_distance || 0);
  });
  return out;
}



function airlinesPerYearSets(data) {
  const map = {};

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years
      map[y] ??= new Set();
      map[y].add(r.airline);
    });

  return map;
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



function countriesPerYearSets(data) {
  const map = {};

  data
    .filter(r => r.journey_type === "Flight" && r.destination_country)
    .forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years
      map[y] ??= new Set();
      map[y].add(r.destination_country);
    });

  return map;
}



function flightsPerYearPerAirline(data, topN = 8) {
  const map = {};
  const airlineTotals = {};

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years

      map[year] ??= {};
      map[year][r.airline] = (map[year][r.airline] || 0) + 1;

      airlineTotals[r.airline] =
        (airlineTotals[r.airline] || 0) + 1;
    });

  // Top airlines by total flights
  const topAirlines = Object.entries(airlineTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([airline]) => airline);

  const years = Object.keys(map).sort();

  const datasets = topAirlines.map(airline => ({
    label: airline,
    data: years.map(y => map[y]?.[airline] || 0),
    backgroundColor: "rgba(201,162,77,0.7)",
    borderColor: "rgba(201,162,77,0.25)",
    borderWidth: 1,
    borderRadius: 4,
    barPercentage: 0.8,
    categoryPercentage: 0.8,
  }));

  return { years, datasets };
}




function flightsPerAirlinePerYear(data) {
  const map = {};
  const airlineTotals = {};

  data
    .filter(r => r.journey_type === "Flight" && r.airline)
    .forEach(r => {
    const y = yearKey(r);
    if (!y) return;          // ⛔ skip invalid/missing years

      map[r.airline] ??= {};
      map[r.airline][year] = (map[r.airline][year] || 0) + 1;

      airlineTotals[r.airline] =
        (airlineTotals[r.airline] || 0) + 1;
    });

  // 🔑 ALL airlines, sorted by total desc
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
    borderColor: "rgba(201,162,77,0.25)",
    borderWidth: 1,
    borderRadius:
      year === years[years.length - 1]
        ? { topRight: 6, bottomRight: 6 }
        : 0,
    barPercentage: 0.75,
    categoryPercentage: 0.8,
  }));

  return { airlines, years, datasets };
}




// =====================================================
// TRANSFORM → CUMULATIVE
// =====================================================
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


// =====================================================
// CHART RENDERER
// =====================================================
function renderYearChart(values, metric) {
  const canvas = document.getElementById("flightsByYearChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = Object.keys(values).sort();
  const data = labels.map(y => Math.round(values[y]));

  if (yearChart) yearChart.destroy();

  const isAllTime = viewMode === "alltime";

  yearChart = new Chart(ctx, {
    type: isAllTime ? "line" : "bar",
    data: {
      labels,
      datasets: [{
        data,
        tension: 0.3,
        fill: false,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderColor: "rgba(201,162,77,0.9)",
        borderWidth: isAllTime ? 3 : 0,
        pointRadius: isAllTime ? 3 : 0,
        borderRadius: isAllTime ? 0 : 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              if (metric === "miles") return `${v.toLocaleString()} miles`;
              return `${v.toLocaleString()}`;
            },
          },
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




let airlineYearStackedChart = null;

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
      datasets: data.datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },

      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 11 } },
          grid: { display: false },
        },
        y: {
          stacked: true,
          ticks: { font: { size: 11 } },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },

      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `Year ${items[0].label}`,
            label: ctx =>
              `${ctx.dataset.label}: ${ctx.raw} flights`,
          },
        },
      },
    },
  });
}



let airlineYearHorizontalChart = null;

function renderFlightsPerAirlineByYear(data) {
  const canvas = document.getElementById("flightsPerAirlineYearChart");
  if (!canvas) return;

  // ----------------------------
  // SCROLL + SIZE CONFIG
  // ----------------------------
  const ROW_HEIGHT = 36;               // visual height per airline
  const totalRows = data.airlines.length;
  const totalHeight = totalRows * ROW_HEIGHT;

  // Make canvas taller than container
  canvas.style.height = `${totalHeight}px`;
  canvas.height = totalHeight;

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
      // 🔑 CRITICAL FOR SCROLL
      responsive: false,
      maintainAspectRatio: false,
      animation: false,

      indexAxis: "y",

      scales: {
        x: {
          stacked: true,
          ticks: { font: { size: 11 }, color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          stacked: true,
          ticks: {
            font: { size: 11 },
            padding: 10,
            autoSkip: false,   // 🔑 show every airline
            color: "#ccc",
          },
          grid: { display: false },
        },
      },

      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0].label,
            label: ctx =>
              `${ctx.dataset.label}: ${ctx.raw} flights`,
          },
        },
      },
    },
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
      return viewMode === "alltime"
        ? cumulative(yearly)
        : yearly;

    case "airlines": {
      const airlineSets = airlinesPerYearSets(baseStatsData);

      if (viewMode === "alltime") {
        return cumulativeDistinctSets(airlineSets);
      }

      // Year mode → size of set per year
      return Object.fromEntries(
        Object.entries(airlineSets).map(([y, set]) => [y, set.size])
      );
    }

    case "countries": {
      const countrySets = countriesPerYearSets(baseStatsData);

      if (viewMode === "alltime") {
        return cumulativeDistinctSets(countrySets);
      }

      return Object.fromEntries(
        Object.entries(countrySets).map(([y, set]) => [y, set.size])
      );
    }

    default:
      yearly = flightsPerYear(baseStatsData);
      return viewMode === "alltime"
        ? cumulative(yearly)
        : yearly;
  }
}



// =====================================================
// INIT + EVENTS
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  baseStatsData = await loadStatsBaseData();

  const metricSelect = document.getElementById("metricSelector");
  const btnYear = document.getElementById("btnYear");
  const btnAllTime = document.getElementById("btnAllTime");
  
  const perYearAirlineData = flightsPerYearPerAirline(baseStatsData);
  renderFlightsPerYearPerAirline(perYearAirlineData);


  const airlineYearData = flightsPerAirlinePerYear(baseStatsData);
  renderFlightsPerAirlineByYear(airlineYearData);
  
  function refresh() {
    renderYearChart(
      getMetricValues(metricSelect.value),
      metricSelect.value
    );
  }

  // Defaults
  refresh();

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
