/* global Chart, sb */

let chart;

const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";


/*
 * =====================================================
 * BAR VALUE LABELS
 * =====================================================
 *
 * Displays the value at the end of each bar.
 *
 * Horizontal:
 *
 * Ryanair    ███████████████  123
 *
 * Vertical:
 *
 *                  12
 *                  ██
 *                  ██
 *                 2024
 */

const barValueLabels = {

  id: "barValueLabels",

  afterDatasetsDraw(chart) {

    const {
      ctx,
      data
    } = chart;

    const horizontal =
      chart.options.indexAxis === "y";

    const dataset =
      chart.getDatasetMeta(0);

    ctx.save();

    /*
     * Match the axis-label appearance.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.55)";

    ctx.font =
      "12px sans-serif";


    dataset.data.forEach(
      (bar, index) => {

        const value =
          Number(
            data.datasets[0].data[index]
          ) || 0;

        if (!value) return;

        const label =
          value.toLocaleString();


        /*
         * Horizontal chart:
         *
         * Put the value just beyond the right-hand
         * end of the bar.
         */
        if (horizontal) {

          ctx.textAlign = "left";
          ctx.textBaseline = "middle";

          ctx.fillText(
            label,
            bar.x + 7,
            bar.y
          );

          return;
        }


        /*
         * Vertical chart:
         *
         * Put the value above the column.
         */
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

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
  
    plugins: [
      barValueLabels
    ],
  
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
        
          /*
           * Horizontal charts need some extra room
           * beyond the longest bar for its value.
           */
          grace:
            horizontal
              ? "8%"
              : 0,
        
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
        
          /*
           * For the vertical "Airlines" chart,
           * explicitly start the Y axis at zero.
           *
           * Horizontal Flights/Miles charts use the Y axis
           * for airline names, so no numeric minimum is needed.
           */
          min:
            horizontal
              ? undefined
              : 0,
        
          beginAtZero: true,
        
        
          /*
           * Leave room above the tallest column for
           * the value label drawn by barValueLabels.
           */
          grace:
            horizontal
              ? 0
              : "10%",
        
        
          grid: {
            color: horizontal
              ? "transparent"
              : GRID
          },
        
        
          ticks: {
        
            /*
             * On the vertical Airlines chart, use whole
             * numbers and explicitly include zero.
             */
            precision:
              horizontal
                ? undefined
                : 0,
        
            callback(value) {
        
              /*
               * Horizontal chart:
               * Y axis contains airline names.
               */
              if (horizontal) {
                return this.getLabelForValue(value);
              }
        
              /*
               * Vertical Airlines chart:
               * Y axis contains number of airlines.
               */
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
