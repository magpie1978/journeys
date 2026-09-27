/* global Chart, sb */

let chart;

const YELLOW = "rgba(204,255,0,0.70)";
const YELLOW_BORDER = "rgba(204,255,0,0.90)";
const GRID = "rgba(255,255,255,0.08)";

/*
 * =====================================================
 * BAR VALUE LABELS
 * =====================================================
 *
 * Displays the number of visits at the right-hand
 * end of each country's bar.
 *
 * Example:
 *
 * Spain        █████████████████  18
 * Ireland      █████████████      14
 * France       ██████████         11
 */

const barValueLabels = {

  id: "barValueLabels",

  afterDatasetsDraw(chart) {

    const {
      ctx,
      data
    } = chart;


    if (!data.datasets.length) {
      return;
    }


    /*
     * Use the final dataset's bar position.
     *
     * Because all datasets are stacked, its x
     * position is the right-hand edge of the
     * complete country bar.
     */

    const lastDatasetIndex =
      data.datasets.length - 1;

    const meta =
      chart.getDatasetMeta(
        lastDatasetIndex
      );


    ctx.save();

    ctx.fillStyle =
      "rgba(255,255,255,0.55)";

    ctx.font =
      "12px sans-serif";

    ctx.textAlign =
      "left";

    ctx.textBaseline =
      "middle";


    data.labels.forEach(
      (country, index) => {

        let total = 0;


        data.datasets.forEach(dataset => {

          total +=
            Number(
              dataset.data[index]
            ) || 0;

        });


        if (!total) {
          return;
        }


        /*
         * Find the right-most visible segment,
         * because the final year may be zero for
         * this particular country.
         */

        let bar = null;


        for (
          let datasetIndex =
            data.datasets.length - 1;

          datasetIndex >= 0;

          datasetIndex--
        ) {

          const value =
            Number(
              data.datasets[
                datasetIndex
              ].data[index]
            ) || 0;


          if (!value) {
            continue;
          }


          const datasetMeta =
            chart.getDatasetMeta(
              datasetIndex
            );


          bar =
            datasetMeta.data[index];

          break;
        }


        if (!bar) {
          return;
        }


        ctx.fillText(
          total.toLocaleString(),
          bar.x + 7,
          bar.y
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

  // Load journeys
  const { data: journeys, error: journeysError } = await sb
    .from("journeys_routes_core_3_mv")
    .select("year, journey_type, origin, destination");

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
  const yearsSet = new Set();


  data.forEach(r => {

    const journeyType =
      String(r.journey_type || "")
        .trim()
        .toLowerCase();


    // Preserve existing behaviour:
    // only Flights and Drives

    if (
      journeyType !== "flight" &&
      journeyType !== "drive"
    ) {
      return;
    }


    if (!r.destination_country) {
      return;
    }


    // Exclude United Kingdom

    if (
      String(r.destination_country)
        .trim()
        .toLowerCase() === "united kingdom"
    ) {
      return;
    }


    // Don't count domestic journeys

    if (
      r.destination_country ===
      r.origin_country
    ) {
      return;
    }


    const year =
      String(r.year || "").slice(0, 4);


    if (!/^\d{4}$/.test(year)) {
      return;
    }


    const country =
      r.destination_country;


    yearsSet.add(year);


    if (!map[country]) {
      map[country] = {};
    }


    map[country][year] =
      (map[country][year] || 0) + 1;

  });


  const years =
    [...yearsSet].sort();


  // Sort countries by TOTAL visits

  const countries =
    Object.keys(map).sort((a, b) => {

      const totalA =
        Object.values(map[a])
          .reduce((sum, n) => sum + n, 0);

      const totalB =
        Object.values(map[b])
          .reduce((sum, n) => sum + n, 0);

      return totalB - totalA;

    });


  return {
    labels: countries,
    years,
    byCountry: map
  };
}


// =====================================================
// RENDER CHART
// =====================================================

function render({
  labels,
  years,
  byCountry
}) {

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
  
    const datasets =
    years.map(year => ({
  
      label: year,
  
      data: labels.map(country =>
        byCountry[country]?.[year] || 0
      ),
  
      /*
       * Deliberately use the SAME colour
       * for every year.
       */
      backgroundColor: YELLOW,
      borderColor: YELLOW_BORDER,
  
      borderWidth: 1,
  
      /*
       * All years belong to the same stack.
       */
      stack: "visits",
  
      categoryPercentage: 0.82,
      barPercentage: 0.90
  
    }));
      
    chart = new Chart(ctx, {
    
      type: "bar",
    
      plugins: [
        barValueLabels
      ],
        
    data: {
    
      labels,
    
      datasets
    
    },

    options: {

      indexAxis: "y",

      responsive: true,
      maintainAspectRatio: false,


      plugins: {

      title: {
        display: true,
        text: "Visits per Country",
      
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
            
      
legend: {
  display: false
},

tooltip: {

  callbacks: {

    /*
     * Use the dataset label (year)
     * as the tooltip heading.
     */
    title(items) {

      if (!items.length) {
        return "";
      }

      return String(
        items[0].dataset.label
      );
    },


    /*
     * Number of visits in that year.
     */
    label(context) {

      const value =
        Number(context.raw) || 0;

      return (
        `${value.toLocaleString()} ` +
        `visit${value === 1 ? "" : "s"}`
      );
    },


    /*
     * Country's total visits across all years.
     */
    footer(items) {

      if (!items.length) {
        return "";
      }

      const index =
        items[0].dataIndex;

      const total =
        items[0].chart.data.datasets
          .reduce(
            (sum, dataset) =>
              sum +
              (
                Number(
                  dataset.data[index]
                ) || 0
              ),
            0
          );

      return (
        `Total: ${total.toLocaleString()} visits`
      );
    }

  }

}


      },


      scales: {
                
        x: {
        
          stacked: true,
        
          beginAtZero: true,
        
          grace: "8%",
        
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
        
          stacked: true,
        
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
