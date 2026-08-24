/* global Chart, sb */

// =====================================================
// FLIGHT STATISTICS
// =====================================================
//
// Loads the journey data required by the Statistics page
// and renders the flight charts.
//
// The base dataset is loaded from Supabase once and cached
// for the lifetime of the page.
//
// Current charts:
//   • Flights per year.
//   • Flights per year, split by airline.
//   • Flights per airline, split by year.
//
// Public behaviour:
//   • Initialises automatically on DOMContentLoaded.
//   • Re-renders when the metric selector changes.
//
// =====================================================


// =====================================================
// STATE
// =====================================================

let baseStatsData = [];

let flightsChart = null;
let flightsByAirlineChart = null;
let flightsPerAirlineYearChart = null;


// =====================================================
// DOM REFERENCES
// =====================================================

const metricSelect =
  document.getElementById("metricSelector");


// =====================================================
// LOAD BASE DATA
// =====================================================

/**
 * Loads the statistics dataset from Supabase.
 *
 * Results are cached after the first successful request so
 * changing chart options does not repeatedly query the
 * database.
 *
 * @returns {Promise<Array>}
 */
async function loadStatsBaseDataOnce() {
  if (baseStatsData.length) {
    return baseStatsData;
  }

  const { data, error } = await sb
    .from("journeys_routes_core_3_mv")
    .select(`
      year,
      journey_type,
      journey_distance,
      airline,
      cabin
    `);

  if (error) {
    console.error(
      "[stats] Statistics data load failed:",
      error
    );

    baseStatsData = [];

    return baseStatsData;
  }

  baseStatsData = data || [];

  return baseStatsData;
}


// =====================================================
// NORMALISATION HELPERS
// =====================================================

/**
 * Extracts a four-digit year from a database value.
 *
 * @param {*} value
 * @returns {string|null}
 */
function normaliseYear(value) {
  if (value == null) {
    return null;
  }

  const year =
    String(value).slice(0, 4);

  return /^\d{4}$/.test(year)
    ? year
    : null;
}


/**
 * Produces a consistent display/grouping name for an
 * airline.
 *
 * Removes bracketed text and common company suffixes,
 * normalises whitespace and converts the result to title
 * case.
 *
 * @param {*} value
 * @returns {string}
 */
function normaliseAirline(value) {
  if (!value) {
    return "Unknown";
  }

  return String(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\b(plc|ltd|limited)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      character => character.toUpperCase()
    );
}


// =====================================================
// STATISTICS CALCULATIONS
// =====================================================

/**
 * Counts flights for each year.
 *
 * @param {Array} data
 * @returns {Object}
 */
function getFlightsPerYear(data) {
  const counts = {};

  data.forEach(row => {
    if (row.journey_type !== "Flight") {
      return;
    }

    const year =
      normaliseYear(row.year);

    if (!year) {
      return;
    }

    counts[year] =
      (counts[year] || 0) + 1;
  });

  return counts;
}


/**
 * Builds the airline/year dataset used by both airline
 * charts.
 *
 * Returned structure:
 *
 * {
 *   years: ["2017", "2018", ...],
 *   datasets: [
 *     {
 *       label: "British Airways",
 *       data: [12, 18, ...],
 *       stack: "airlines"
 *     }
 *   ]
 * }
 *
 * @param {Array} data
 * @returns {{years: Array<string>, datasets: Array}}
 */
function getFlightsPerYearPerAirline(data) {
  const counts = {};

  const yearsSet = new Set();
  const airlinesSet = new Set();

  data.forEach(row => {
    if (row.journey_type !== "Flight") {
      return;
    }

    const year =
      normaliseYear(row.year);

    if (!year) {
      return;
    }

    const airline =
      normaliseAirline(row.airline);

    yearsSet.add(year);
    airlinesSet.add(airline);

    if (!counts[year]) {
      counts[year] = {};
    }

    counts[year][airline] =
      (counts[year][airline] || 0) + 1;
  });

  const years =
    [...yearsSet].sort();

  const airlines =
    [...airlinesSet].sort();

  const datasets =
    airlines.map(airline => ({
      label: airline,

      data: years.map(
        year =>
          counts[year]?.[airline] || 0
      ),

      stack: "airlines"
    }));

  return {
    years,
    datasets
  };
}


// =====================================================
// CHART: FLIGHTS PER YEAR
// =====================================================

/**
 * Renders the total number of flights for each year.
 *
 * @param {Object} values
 */
function renderFlightsByYear(values) {
  const canvas =
    document.getElementById(
      "flightsByYearChart"
    );

  if (!canvas) {
    return;
  }

  const context =
    canvas.getContext("2d");

  if (flightsChart) {
    flightsChart.destroy();
  }

  const years =
    Object.keys(values).sort();

  const data =
    years.map(year => values[year]);

  flightsChart = new Chart(
    context,
    {
      type: "bar",

      data: {
        labels: years,

        datasets: [
          {
            label: "Flights",
            data,
            backgroundColor:
              "rgba(201,162,77,0.7)",
            borderRadius: 6
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: false
          }
        },

        scales: {
          x: {
            grid: {
              display: false
            },

            ticks: {
              color: "#ccc"
            }
          },

          y: {
            grid: {
              color:
                "rgba(255,255,255,0.08)"
            },

            ticks: {
              color: "#ccc",
              precision: 0
            }
          }
        }
      }
    }
  );
}


// =====================================================
// CHART: FLIGHTS PER YEAR BY AIRLINE
// =====================================================

/**
 * Renders yearly flight totals split into stacked airline
 * segments.
 *
 * @param {Array<string>} years
 * @param {Array} datasets
 */
function renderFlightsPerYearPerAirline(
  years,
  datasets
) {
  const canvas =
    document.getElementById(
      "flightsPerYearAirlineChart"
    );

  if (!canvas) {
    return;
  }

  const context =
    canvas.getContext("2d");

  if (flightsByAirlineChart) {
    flightsByAirlineChart.destroy();
  }

  flightsByAirlineChart =
    new Chart(
      context,
      {
        type: "bar",

        data: {
          labels: years,

          datasets: datasets.map(
            dataset => ({
              ...dataset,

              backgroundColor:
                "rgba(201,162,77,0.7)",

              borderRadius: 4
            })
          )
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,

          plugins: {
            legend: {
              display: false
            }
          },

          scales: {
            x: {
              stacked: true,

              ticks: {
                color: "#ccc"
              }
            },

            y: {
              stacked: true,

              ticks: {
                color: "#ccc",
                precision: 0
              }
            }
          }
        }
      }
    );
}


// =====================================================
// CHART: FLIGHTS PER AIRLINE BY YEAR
// =====================================================

/**
 * Renders a horizontal stacked chart showing each airline
 * with its flights divided by year.
 *
 * The canvas height grows with the number of airlines so
 * labels remain readable.
 *
 * @param {Array<string>} airlines
 * @param {Array} datasets
 */
function renderFlightsPerAirlineByYear(
  airlines,
  datasets
) {
  const canvas =
    document.getElementById(
      "flightsPerAirlineYearChart"
    );

  if (!canvas) {
    return;
  }

  const container =
    canvas.parentElement;

  canvas.height =
    Math.max(
      airlines.length * 36,
      300
    );

  canvas.width =
    container?.clientWidth || 800;

  const context =
    canvas.getContext("2d");

  if (flightsPerAirlineYearChart) {
    flightsPerAirlineYearChart.destroy();
  }

  flightsPerAirlineYearChart =
    new Chart(
      context,
      {
        type: "bar",

        data: {
          labels: airlines,

          datasets: datasets.map(
            dataset => ({
              ...dataset,

              backgroundColor:
                "rgba(201,162,77,0.7)",

              borderRadius: 4
            })
          )
        },

        options: {
          indexAxis: "y",

          /*
           * This chart is sized manually because its
           * height depends on the number of airlines.
           */
          responsive: false,
          maintainAspectRatio: false,

          plugins: {
            legend: {
              display: false
            }
          },

          scales: {
            x: {
              stacked: true,

              ticks: {
                color: "#ccc",
                precision: 0
              },

              grid: {
                color:
                  "rgba(255,255,255,0.05)"
              }
            },

            y: {
              stacked: true,

              ticks: {
                color: "#ccc"
              },

              grid: {
                display: false
              }
            }
          }
        }
      }
    );
}


// =====================================================
// MAIN UPDATE
// =====================================================

/**
 * Loads the cached statistics data and renders the charts
 * required by the currently selected metric.
 */
async function updateStats() {
  const data =
    await loadStatsBaseDataOnce();

  const metric =
    metricSelect?.value || "flights";

  /*
   * Only the Flights metric is currently implemented.
   * Keeping this guard makes the function ready for
   * additional statistics metrics later.
   */
  if (metric !== "flights") {
    return;
  }

  // Total flights by year.
  renderFlightsByYear(
    getFlightsPerYear(data)
  );

  /*
   * Build the shared airline/year breakdown once and use
   * it for both airline charts.
   */
  const {
    years,
    datasets
  } = getFlightsPerYearPerAirline(data);

  // Flights per year, split by airline.
  renderFlightsPerYearPerAirline(
    years,
    datasets
  );

  /*
   * Pivot the same data so airlines become the labels and
   * years become the stacked datasets.
   */
  renderFlightsPerAirlineByYear(
    datasets.map(
      dataset => dataset.label
    ),

    years.map((year, index) => ({
      label: year,

      data: datasets.map(
        dataset => dataset.data[index]
      ),

      stack: "years"
    }))
  );
}


// =====================================================
// INITIALISATION
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  updateStats
);

metricSelect?.addEventListener(
  "change",
  updateStats
);
