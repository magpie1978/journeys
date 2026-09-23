/* global Chart, sb */

let chart;

const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

  // Load journeys
  const { data: journeys, error: journeysError } = await sb
    .from("journeys_routes_core_3_mv")
    .select("journey_type, origin, destination");

  if (journeysError) {
    console.error(
      "[country stats] journey load failed:",
      journeysError
    );

    return [];
  }


  // Load location → country mapping
  const { data: locations, error: locationsError } = await sb
    .from("journey_locations")
    .select("airport_code, country");

  if (locationsError) {
    console.error(
      "[country stats] location load failed:",
      locationsError
    );

    return [];
  }


  // Build fast lookup:
  // AMS → Netherlands
  // ORK → Ireland
  // etc.

  const countryByLocation = {};

  (locations || []).forEach(location => {

    if (!location.airport_code) return;
    if (!location.country) return;

    countryByLocation[
      String(location.airport_code).trim()
    ] = String(location.country).trim();

  });


  // Add country information to each journey

  return (journeys || []).map(journey => ({

    ...journey,

    origin_country:
      countryByLocation[
        String(journey.origin || "").trim()
      ] || null,

    destination_country:
      countryByLocation[
        String(journey.destination || "").trim()
      ] || null

  }));
}


// =====================================================
// VISITS PER COUNTRY
// =====================================================

function visitsPerCountry(data) {

  const map = {};

  data.forEach(r => {

    const journeyType =
      String(r.journey_type || "")
        .trim()
        .toLowerCase();


    // Preserve original behaviour:
    // only Flights and Drives

    if (
      journeyType !== "flight" &&
      journeyType !== "drive"
    ) return;


    // Destination must have a country

    if (!r.destination_country) return;


    // Don't count domestic journeys as
    // a new visit to the same country

    if (
      r.destination_country ===
      r.origin_country
    ) return;


    map[r.destination_country] =
      (map[r.destination_country] || 0) + 1;

  });


  // Most visited first

  const countries =
    Object.keys(map).sort(
      (a, b) => map[b] - map[a]
    );


  return {

    labels: countries,

    values: countries.map(
      country => map[country]
    )

  };
}


// =====================================================
// RENDER CHART
// =====================================================

function render({ labels, values }) {

  /*
   * -----------------------------------------------------
   * FIND THE CHART CANVAS
   * -----------------------------------------------------
   */

  const ctx =
    document.getElementById(
      "visitsPerCountryChart"
    );

  
    if (!ctx) {
  
      console.error(
        "[country stats] visitsPerCountryChart not found"
      );
  
      return;
    }
  
  
    /*
     * -----------------------------------------------------
     * DYNAMIC CHART HEIGHT
     * -----------------------------------------------------
     *
     * Give every country enough vertical room for its
     * label and horizontal bar.
     *
     * The outer chart window stays 680px high.
     * The inner chart can become considerably taller,
     * producing a vertical scrollbar.
     */
  
    const chartInner =
      document.getElementById(
        "countryChartInner"
      );
  
  
    if (!chartInner) {
  
      console.error(
        "[country stats] countryChartInner not found"
      );
  
      return;
    }
  
  
    /*
     * Give each country a 34px row.
     *
     * For example:
     *
     *     30 countries × 34px = 1,020px
     *     50 countries × 34px = 1,700px
     *
     * Only 680px is visible at once, so the remainder
     * can be reached by scrolling.
     */
  
    const ROW_HEIGHT = 34;
    const MIN_HEIGHT = 680;
  
    const requiredHeight =
      Math.max(
        MIN_HEIGHT,
        labels.length * ROW_HEIGHT
      );
  
  
    chartInner.style.height =
      `${requiredHeight}px`;
  
  
    /*
     * Destroy the previous chart before drawing another.
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

  /*
   * Make each bar use most of its allocated 34px row.
   */
  categoryPercentage: 0.82,
  barPercentage: 0.90

}]
    },


    options: {

      indexAxis: "y",

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

              return (
                `${value.toLocaleString()} visits`
              );

            }

          }

        }

      },


      scales: {

        x: {

          beginAtZero: true,

          ticks: {

            precision: 0,

            callback(value) {
              return Number(value)
                .toLocaleString();
            }

          },

          grid: {
            color: GRID
          }

        },


        y: {

          grid: {
            display: false
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
      `[country stats] loaded ${data.length} journeys`
    );


    const stats =
      visitsPerCountry(data);


    console.log(
      `[country stats] ${stats.labels.length} countries`
    );


    render(stats);

  }
);
