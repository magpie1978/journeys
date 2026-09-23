/* global Chart, sb */

let chart;

const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";


// =====================================================
// HELPERS
// =====================================================

function year4(v) {
  return String(v).slice(0, 4);
}


function isFlight(r) {
  return (
    String(r.journey_type || "")
      .trim()
      .toLowerCase() === "flight"
  );
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select(
      "year, airline, journey_type, journey_distance"
    );

  if (error) {
    console.error(
      "[airlines by year] load failed:",
      error
    );

    return [];
  }

  return data || [];
}


// =====================================================
// NUMBER OF DISTINCT AIRLINES PER YEAR
// =====================================================

function airlinesPerYear(data) {

  const map = {};

  data.forEach(r => {

    if (!isFlight(r)) return;
    if (!r.airline) return;

    const year = year4(r.year);

    if (!/^\d{4}$/.test(year)) return;

    if (!map[year]) {
      map[year] = new Set();
    }

    map[year].add(
      String(r.airline).trim()
    );
  });


  const years =
    Object.keys(map).sort();


  return {
    labels: years,

    values: years.map(
      year => map[year].size
    )
  };
}


// =====================================================
// FLIGHTS / MILES PER AIRLINE
// =====================================================

function metricPerAirline(data, metric) {

  const map = {};

  data.forEach(r => {

    if (!isFlight(r)) return;
    if (!r.airline) return;

    const airline =
      String(r.airline).trim();

    const value =
      metric === "miles"
        ? Number(r.journey_distance) || 0
        : 1;

    map[airline] =
      (map[airline] || 0) + value;
  });


  const airlines =
    Object.keys(map).sort(
      (a, b) => map[b] - map[a]
    );


  return {
    labels: airlines,

    values: airlines.map(airline =>
      metric === "miles"
        ? Math.round(map[airline])
        : map[airline]
    )
  };
}


// =====================================================
// RENDER
// =====================================================

function render(
  { labels, values },
  metric,
  horizontal = true
) {

  /*
   * -----------------------------------------------------
   * FIND THE CHART CANVAS
   * -----------------------------------------------------
   */

  const ctx =
    document.getElementById(
      "flightsPerAirlineYearChart"
    );


  if (!ctx) {

    console.error(
      "[airlines by year] chart canvas not found"
    );

    return;
  }


  /*
   * -----------------------------------------------------
   * DYNAMIC CHART HEIGHT
   * -----------------------------------------------------
   *
   * Chart.js sizes itself from the height of its parent.
   *
   * For horizontal charts, each airline gets 34px of
   * vertical space. If the complete chart is taller
   * than 680px, the outer container provides scrolling.
   */

  const chartInner =
    document.getElementById(
      "airlineChartInner"
    );


  if (!chartInner) {

    console.error(
      "[airlines by year] airlineChartInner not found"
    );

    return;
  }


  if (horizontal) {

    const ROW_HEIGHT = 34;
    const MIN_HEIGHT = 680;

    const requiredHeight =
      Math.max(
        MIN_HEIGHT,
        labels.length * ROW_HEIGHT
      );

    chartInner.style.height =
      `${requiredHeight}px`;

  } else {

    chartInner.style.height =
      "680px";
  }


  /*
   * Destroy the previous chart before drawing
   * the replacement.
   */

  if (chart) {
    chart.destroy();
  }


  chart = new Chart(ctx, {
    
    type: "bar",

    data: {

      labels,
    
    datasets: [{
      data: values,
      backgroundColor: YELLOW,
      borderColor: YELLOW_BORDER,
      borderWidth: 1,
      borderRadius: 6,
    
      // Use more of the available space for each bar.
      categoryPercentage: 0.82,
      barPercentage: 0.90
    }]    
    },


    options: {

      indexAxis:
        horizontal ? "y" : "x",

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

                return (
                  `${value.toLocaleString()} miles`
                );
              }


              if (metric === "airlines") {

                return (
                  `${value.toLocaleString()} airlines`
                );
              }


              return (
                `${value.toLocaleString()} flights`
              );
            }
          }
        }
      },


      scales: {

        x: {

          beginAtZero: true,

          grid: {
            color: horizontal
              ? GRID
              : "transparent"
          },

          ticks: {

            callback(value) {

              return Number(value)
                .toLocaleString();
            }
          }
        },


        y: {

          beginAtZero: true,

          grid: {
            color: horizontal
              ? "transparent"
              : GRID
          },

          ticks: {

            callback(value) {

              /*
               * For horizontal charts the Y axis
               * contains airline names, so return
               * Chart.js's original label.
               */

              if (horizontal) {
                return this.getLabelForValue(value);
              }

              return Number(value)
                .toLocaleString();
            }
          }
        }
      }
    }
  });
}


// =====================================================
// INITIALISE
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const data =
      await loadData();

    console.log(
      `[airlines by year] loaded ${data.length} rows`
    );


    const select =
      document.getElementById(
        "airlineMetricSelect"
      );


    if (!select) {

      console.error(
        "[airlines by year] airlineMetricSelect not found"
      );

      return;
    }


    function update() {

      const metric =
        select.value;


      // Airlines used per year

      if (metric === "airlines") {

        render(
          airlinesPerYear(data),
          metric,
          false
        );

        return;
      }


      // Flights or miles per airline

      render(
        metricPerAirline(
          data,
          metric
        ),
        metric,
        true
      );
    }


    update();

    select.addEventListener(
      "change",
      update
    );

  }
);
