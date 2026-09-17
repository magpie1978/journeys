/* global Chart, sb */

let flightsChart;
let flightData = [];
let timeMode = "year";

const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";


function year4(v) {
  return String(v).slice(0, 4);
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {
  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select("year, journey_type, journey_distance");

  if (error) {
    console.error("[flight stats] load failed:", error);
    return [];
  }

  return data || [];
}


// =====================================================
// CALCULATE FLIGHTS / MILES PER YEAR
// =====================================================

function flightsPerYear(data, metric = "flights") {
  const map = {};

  data.forEach(r => {

    if (
      String(r.journey_type || "").toLowerCase()
      !== "flight"
    ) return;

    const y = year4(r.year);

    if (!/^\d{4}$/.test(y)) return;

    const val =
      metric === "miles"
        ? Number(r.journey_distance) || 0
        : 1;

    map[y] = (map[y] || 0) + val;
  });

  const years = Object.keys(map).sort();

  return {
    labels: years,
    values: years.map(y => map[y])
  };
}


// =====================================================
// RENDER CHART
// =====================================================

function renderChart({ labels, values }, metric) {

  const ctx =
    document.getElementById("flightsByYearChart");

  if (!ctx) return;

  if (flightsChart) {
    flightsChart.destroy();
  }

  flightsChart = new Chart(ctx, {
    type: "bar",

    data: {
      labels,

      datasets: [{
        data: values,
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1,
        borderRadius: 6
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label(context) {

              const value =
                Number(context.raw) || 0;

              if (metric === "miles") {
                return `${value.toLocaleString()} miles`;
              }

              return `${value.toLocaleString()} flights`;
            }
          }
        }
      },

      scales: {
        x: {
          grid: {
            display: false
          }
        },

        y: {
          beginAtZero: true,

          grid: {
            color: GRID
          },

          ticks: {
            callback(value) {
              return Number(value).toLocaleString();
            }
          }
        }
      }
    }
  });
}


// =====================================================
// UPDATE CHART
// =====================================================

function updateChart() {

  const metricSelector =
    document.getElementById("metricSelector");

  const metric =
    metricSelector?.value || "flights";


  // Calculate annual figures first

  const stats =
    flightsPerYear(flightData, metric);


  // =====================================================
  // YEAR MODE
  // Individual value for each year
  // =====================================================

  if (timeMode === "year") {

    renderChart(
      {
        labels: stats.labels,

        values: stats.values.map(value =>
          Math.round(value)
        )
      },
      metric
    );

    return;
  }


  // =====================================================
  // ALL TIME MODE
  // Running cumulative total
  // =====================================================

  let runningTotal = 0;

  const cumulativeValues =
    stats.values.map(value => {

      runningTotal += value;

      return Math.round(runningTotal);
    });


  renderChart(
    {
      labels: stats.labels,
      values: cumulativeValues
    },
    metric
  );
}


// =====================================================
// INITIALISE
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

  flightData = await loadData();

  console.log(
    `[flight stats] loaded ${flightData.length} rows`
  );


  // Initial chart

  updateChart();


  // =====================================================
  // FLIGHTS / MILES
  // =====================================================

  const metricSelector =
    document.getElementById("metricSelector");

  metricSelector?.addEventListener(
    "change",
    updateChart
  );


  // =====================================================
  // YEAR / ALL TIME
  // =====================================================

  const btnYear =
    document.getElementById("btnYear");

  const btnAllTime =
    document.getElementById("btnAllTime");


  btnYear?.addEventListener("click", () => {

    timeMode = "year";

    btnYear.classList.add("active");
    btnAllTime?.classList.remove("active");

    updateChart();
  });


  btnAllTime?.addEventListener("click", () => {

    timeMode = "all";

    btnAllTime.classList.add("active");
    btnYear?.classList.remove("active");

    updateChart();
  });

});
