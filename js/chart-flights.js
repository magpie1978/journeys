/* global Chart, sb */

let flightsChart;
let flightData = [];
let timeMode = "year";

const MJ_ACCENT = "rgba(204,255,0,0.70)";
const MJ_ACCENT_BORDER = "rgba(204,255,0,0.90)";
const GRID = "rgba(255,255,255,0.08)";


function year4(v) {
  return String(v).slice(0, 4);
}


/*
 * =====================================================
 * BAR VALUE LABELS
 * =====================================================
 *
 * Displays the value of each bar directly above it.
 *
 * Examples:
 *
 *     44
 *     ██
 *     ██
 *    2017
 *
 * For miles, thousands separators are added:
 *
 *     12,450
 *     █████
 *      2017
 */

const barValueLabels = {

  id: "barValueLabels",

  afterDatasetsDraw(chart) {

    const {
      ctx,
      data
    } = chart;


    ctx.save();
    
    /*
     * Match the bar-top labels to the Chart.js
     * axis label styling.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.55)";
    
    ctx.font =
      "12px sans-serif";
        ctx.textAlign =
          "center";
    
    ctx.textBaseline =
      "bottom";


    const dataset =
      chart.getDatasetMeta(0);


    dataset.data.forEach(
      (bar, index) => {

        const value =
          Number(
            data.datasets[0].data[index]
          ) || 0;


        /*
         * Don't display a label for zero-value bars.
         */
        if (!value) return;


        const label =
          value.toLocaleString();


        /*
         * bar.x = horizontal centre of column
         * bar.y = top of column
         *
         * Subtract 5px so the number sits slightly
         * above the yellow bar.
         */
        ctx.fillText(
          label,
          bar.x,
          bar.y - 5
        );

      }
    );


    ctx.restore();
  }

};



// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {
  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select("year, journey_type, journey_distance, cabin");

  if (error) {
    console.error("[flight stats] load failed:", error);
    return [];
  }

  return data || [];
}


// =====================================================
// CABIN HELPER
// =====================================================

function cabinFlightsPerYear(data) {

  const byYear = {};
  const cabinSet = new Set();

  data.forEach(row => {

    if (
      String(row.journey_type || "").toLowerCase()
      !== "flight"
    ) {
      return;
    }

    const year =
      String(row.year || "").slice(0, 4);

    if (!/^\d{4}$/.test(year)) {
      return;
    }

    const cabin =
      String(row.cabin || "").trim() ||
      "Unknown";

    cabinSet.add(cabin);

    if (!byYear[year]) {
      byYear[year] = {};
    }

    byYear[year][cabin] =
      (byYear[year][cabin] || 0) + 1;

  });

  const years =
    Object.keys(byYear).sort();

  const cabins =
    [...cabinSet].sort();

  return {
    years,
    cabins,
    byYear
  };
}


// =====================================================
// CABIN CHART RENDERER
// =====================================================
function renderCabinChart(data) {

  const {
    years,
    cabins,
    byYear
  } = cabinFlightsPerYear(data);


  /*
   * One stable colour for each cabin.
   *
   * Add/change cabin names here to match the values
   * actually stored in your database.
   */
  const cabinColours = {
    Economy: "#CCFF00",
    "Premium Economy": "#4DA6C9",
    Business: "#8B6CC9",
    First: "#C96C6C",
    Unknown: "#777777"
  };

  /*
   * YEAR
   *
   * Each year is an independent stacked bar.
   */
  let datasets;

  if (timeMode === "year") {

    datasets = cabins.map(cabin => ({
      label: cabin,

      data: years.map(year =>
        byYear[year]?.[cabin] || 0
      ),

      backgroundColor:
        cabinColours[cabin] || "#999999",

      borderWidth: 0,

      stack: "cabins"
    }));

  }


  /*
   * ALL TIME
   *
   * Maintain a running cumulative count for
   * each individual cabin.
   */
  else {

    const running = {};

    cabins.forEach(cabin => {
      running[cabin] = 0;
    });


    const cumulative =
      years.map(year => {

        const result = {};

        cabins.forEach(cabin => {

          running[cabin] +=
            byYear[year]?.[cabin] || 0;

          result[cabin] =
            running[cabin];

        });

        return result;
      });


    datasets = cabins.map(cabin => ({
      label: cabin,

      data: cumulative.map(row =>
        row[cabin]
      ),

      backgroundColor:
        cabinColours[cabin] || "#999999",

      borderWidth: 0,

      stack: "cabins"
    }));

  }


  if (flightsChart) {
    flightsChart.destroy();
  }


  const ctx =
    document.getElementById(
      "flightsByYearChart"
    );


  flightsChart = new Chart(ctx, {

    type: "bar",

    data: {
      labels: years,
      datasets
    },

    options: {

      responsive: true,
      maintainAspectRatio: false,

      plugins: {

        title: {
          display: true,

          text:
            timeMode === "year"
              ? "Flights per Year by Cabin"
              : "Cumulative Flights by Cabin",

          color: "#ffffff",

          font: {
            size: 20,
            weight: "600"
          },

          padding: {
            top: 14,
            bottom: 4
          }
        },


        subtitle: {
          display: true,

          text:
            timeMode === "year"
              ? "Number of flights by cabin each year"
              : "Cumulative number of flights by cabin",

          color:
            "rgba(255,255,255,0.55)",

          font: {
            size: 13,
            weight: "400"
          },

          padding: {
            top: 0,
            bottom: 18
          }
        },

        tooltip: {

          callbacks: {

            label(context) {

              const value =
                Number(context.raw) || 0;

              return (
                `${context.dataset.label}: ` +
                `${value} flight` +
                `${value === 1 ? "" : "s"}`
              );
            },

            footer(items) {

              const total =
                items.reduce(
                  (sum, item) =>
                    sum +
                    (Number(item.raw) || 0),
                  0
                );

              return `Total: ${total} flights`;
            }
          }
        }
      },


      scales: {

        x: {
          stacked: true,

          grid: {
            display: false
          }
        },

        y: {
          stacked: true,
          beginAtZero: true,

          ticks: {
            precision: 0
          },

          grid: {
            color:
              "rgba(255,255,255,0.08)"
          }
        }
      }
    }
  });
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
  
    plugins: [
      barValueLabels
    ],
    
    data: {
      labels,

    datasets: [{
      data: values,
      backgroundColor: MJ_ACCENT,
      borderColor: MJ_ACCENT_BORDER,
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

  /*
   * ---------------------------------------------------
   * CHART TITLE
   * ---------------------------------------------------
   *
   * Display a centred description inside the chart
   * itself.
   */

  title: {
    display: true,

    text:
      metric === "miles"
        ? (
            timeMode === "all"
              ? "Cumulative Miles"
              : "Miles per Year"
          )
        : (
            timeMode === "all"
              ? "Cumulative Flights"
              : "Flights per Year"
          ),

    color: "#ffffff",

    font: {
      size: 20,
      weight: "600"
    },

    padding: {
      top: 8,
      bottom: 4
    }
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
        
          /*
           * Leave some space above the tallest bar
           * for its value label.
           */
          grace: "10%",
        
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

// =====================================================
// UPDATE CHART
// =====================================================

function updateChart() {

  const metricSelector =
    document.getElementById("metricSelector");

  const metric =
    metricSelector?.value || "flights";


  // =====================================================
  // CABIN MODE
  // =====================================================

  if (metric === "cabin") {

    renderCabinChart(flightData);

    return;
  }


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
