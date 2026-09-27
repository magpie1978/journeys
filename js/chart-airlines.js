/* global Chart, sb */

let chart;

const YELLOW = "rgba(204,255,0,0.70)";
const YELLOW_BORDER = "rgba(204,255,0,0.90)";
const GRID = "rgba(255,255,255,0.08)";


// =====================================================
// STACK TOTAL LABELS
// =====================================================

const stackTotalLabels = {

  id: "stackTotalLabels",

  afterDatasetsDraw(chart) {

    const {
      ctx,
      data
    } = chart;


    if (!data.datasets.length) {
      return;
    }


    ctx.save();

    ctx.fillStyle =
      "rgba(255,255,255,0.70)";

    ctx.font =
      "12px sans-serif";

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "bottom";


    data.labels.forEach(
      (label, index) => {

        /*
         * Total all currently displayed airline
         * datasets for this year.
         *
         * Because filtered-out airlines are not
         * present in data.datasets, the total
         * automatically follows the dropdown.
         */

        const total =
          data.datasets.reduce(
            (sum, dataset) =>
              sum +
              (Number(dataset.data[index]) || 0),
            0
          );


        if (!total) {
          return;
        }


        /*
         * Find the highest visible segment in
         * this year's stacked bar.
         */

        let topY = null;
        let centreX = null;


        data.datasets.forEach(
          (dataset, datasetIndex) => {

            const value =
              Number(
                dataset.data[index]
              ) || 0;

            if (!value) {
              return;
            }


            const meta =
              chart.getDatasetMeta(
                datasetIndex
              );

            const bar =
              meta.data[index];


            if (!bar) {
              return;
            }


            centreX = bar.x;

            if (
              topY === null ||
              bar.y < topY
            ) {
              topY = bar.y;
            }

          }
        );


        if (
          centreX === null ||
          topY === null
        ) {
          return;
        }


        ctx.fillText(
          total.toLocaleString(),
          centreX,
          topY - 6
        );

      }
    );


    ctx.restore();

  }

};


let airlineStats = null;
let selectedAirlines = new Set();


// =====================================================
// HELPERS
// =====================================================

function year4(v) {
  return String(v).slice(0, 4);
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadData() {

  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select("year, journey_type, airline");

  if (error) {
    console.error(
      "[airline stats] load failed:",
      error
    );

    return [];
  }

  return data || [];
}


// =====================================================
// AGGREGATE FLIGHTS BY YEAR / AIRLINE
// =====================================================

function aggregate(data) {

  const map = {};
  const airlinesSet = new Set();

  data.forEach(r => {

    if (
      String(r.journey_type || "")
        .toLowerCase() !== "flight"
    ) {
      return;
    }

    if (!r.airline) return;

    const year = year4(r.year);

    if (!/^\d{4}$/.test(year)) {
      return;
    }

    const airline =
      String(r.airline).trim();

    airlinesSet.add(airline);

    if (!map[year]) {
      map[year] = {};
    }

    map[year][airline] =
      (map[year][airline] || 0) + 1;
  });


  const years =
    Object.keys(map).sort();


  // Order airlines by total number of flights

  const airlineTotals = {};

  airlinesSet.forEach(airline => {

    airlineTotals[airline] = 0;

    years.forEach(year => {

      airlineTotals[airline] +=
        map[year]?.[airline] || 0;

    });

  });


  const airlines =
    [...airlinesSet].sort(
      (a, b) =>
        airlineTotals[b] -
        airlineTotals[a]
    );


  return {
    years,
    airlines,
    map
  };
}


// =====================================================
// FILTERED AIRLINES
// =====================================================

function getVisibleAirlines() {

  if (!airlineStats) {
    return [];
  }

  /*
   * No individual selections means:
   * show every airline.
   */

  if (selectedAirlines.size === 0) {
    return airlineStats.airlines;
  }

  return airlineStats.airlines.filter(
    airline =>
      selectedAirlines.has(airline)
  );
}


// =====================================================
// UPDATE FILTER LABEL
// =====================================================

function updateFilterLabel() {

  const label =
    document.getElementById(
      "airlineFilterLabel"
    );

  const all =
    document.getElementById(
      "airlineFilterAll"
    );

  if (!label) return;


  if (selectedAirlines.size === 0) {

    label.textContent =
      "All Airlines";

    if (all) {
      all.checked = true;
    }

    return;
  }


  if (all) {
    all.checked = false;
  }


  if (selectedAirlines.size === 1) {

    label.textContent =
      [...selectedAirlines][0];

    return;
  }


  label.textContent =
    `${selectedAirlines.size} Airlines`;
}


// =====================================================
// RENDER FILTER OPTIONS
// =====================================================

function buildAirlineFilter() {

  if (!airlineStats) return;


  const filter =
    document.getElementById(
      "airlineFilter"
    );

  const button =
    document.getElementById(
      "airlineFilterButton"
    );

  const menu =
    document.getElementById(
      "airlineFilterMenu"
    );

  const list =
    document.getElementById(
      "airlineFilterList"
    );

  const all =
    document.getElementById(
      "airlineFilterAll"
    );


  if (
    !filter ||
    !button ||
    !menu ||
    !list ||
    !all
  ) {
    return;
  }


  list.innerHTML = "";


  [...airlineStats.airlines]
    .sort((a, b) =>
      a.localeCompare(b)
    )
    .forEach(
      airline => {
      
      const option =
        document.createElement("label");

      option.className =
        "airline-filter-option";


      const checkbox =
        document.createElement("input");

      checkbox.type = "checkbox";
      checkbox.value = airline;
      checkbox.checked = false;


      const text =
        document.createElement("span");

      text.textContent = airline;


      checkbox.addEventListener(
        "change",
        () => {

          if (checkbox.checked) {

            selectedAirlines.add(
              airline
            );

          } else {

            selectedAirlines.delete(
              airline
            );

          }


          updateFilterLabel();
          renderCurrentChart();
        }
      );


      option.appendChild(checkbox);
      option.appendChild(text);

      list.appendChild(option);

    }
  );


  // -----------------------------------------------------
  // ALL AIRLINES
  // -----------------------------------------------------

  all.addEventListener(
    "change",
    () => {

      if (!all.checked) {
        all.checked = true;
        return;
      }


      selectedAirlines.clear();


      list
        .querySelectorAll(
          'input[type="checkbox"]'
        )
        .forEach(
          checkbox => {
            checkbox.checked = false;
          }
        );


      updateFilterLabel();
      renderCurrentChart();

    }
  );


  // -----------------------------------------------------
  // OPEN / CLOSE DROPDOWN
  // -----------------------------------------------------

  button.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      filter.classList.toggle(
        "open"
      );

    }
  );


  menu.addEventListener(
    "click",
    event => {

      event.stopPropagation();

    }
  );


  document.addEventListener(
    "click",
    () => {

      filter.classList.remove(
        "open"
      );

    }
  );


  updateFilterLabel();
}


// =====================================================
// RENDER CURRENT FILTERED CHART
// =====================================================

function renderCurrentChart() {

  if (!airlineStats) return;


  render({

    years:
      airlineStats.years,

    airlines:
      getVisibleAirlines(),

    map:
      airlineStats.map

  });
}


// =====================================================
// RENDER
// =====================================================

function render({
  years,
  airlines,
  map
}) {

  const ctx =
    document.getElementById(
      "flightsPerYearAirlineChart"
    );


  if (!ctx) {

    console.error(
      "[airline stats] chart canvas not found"
    );

    return;
  }


  if (chart) {
    chart.destroy();
  }


  const datasets =
    airlines.map(airline => ({

      // Keep airline name for tooltip
      label: airline,

      data: years.map(
        year =>
          map[year]?.[airline] || 0
      ),

      // KEEP EXISTING COLOURS
      backgroundColor: YELLOW,
      borderColor: YELLOW_BORDER,

      borderWidth: 1

    }));


chart = new Chart(ctx, {

  type: "bar",

  plugins: [
    stackTotalLabels
  ],

  data: {
    labels: years,
    datasets
  },

  options: {
      responsive: true,
      maintainAspectRatio: false,


      interaction: {
        mode: "nearest",
        intersect: true
      },


      plugins: {

        // -------------------------------------------------
        // TITLE
        // -------------------------------------------------

        title: {

          display: true,

          text:
            "Flights per Year per Airline",

          color: "#ffffff",

          font: {
            size: 20,
            weight: "600"
          },

          padding: {
            top: 14,
            bottom: 14
          }

        },


        // -------------------------------------------------
        // LEGEND
        // -------------------------------------------------

        legend: {
          display: false
        },


        // -------------------------------------------------
        // TOOLTIP
        // -------------------------------------------------

        tooltip: {

          mode: "nearest",
          intersect: true,

          callbacks: {

            title(context) {

              return (
                context[0]?.label || ""
              );

            },


            label(context) {

              const value =
                Number(
                  context.raw
                ) || 0;


              if (!value) {
                return null;
              }


              return (
                `${context.dataset.label}: ` +
                `${value} flights`
              );

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
        
          grace: "10%",
        
          ticks: {
            precision: 0
          },
          
          grid: {
            color: GRID
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
      `[airline stats] loaded ` +
      `${data.length} rows`
    );


    airlineStats =
      aggregate(data);


    buildAirlineFilter();

    renderCurrentChart();

  }
);
