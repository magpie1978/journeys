/* global Chart, sb */

let chart;

const YELLOW = "rgba(201,162,77,0.85)";
const YELLOW_BORDER = "rgba(255,235,170,1)";
const GRID = "rgba(255,255,255,0.08)";


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
    console.error("[airline stats] load failed:", error);
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
      String(r.journey_type || "").toLowerCase()
      !== "flight"
    ) return;

    if (!r.airline) return;

    const year = year4(r.year);

    if (!/^\d{4}$/.test(year)) return;

    const airline = r.airline.trim();

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
        airlineTotals[b] - airlineTotals[a]
    );


  return {
    years,
    airlines,
    map
  };
}


// =====================================================
// RENDER
// =====================================================

function render({ years, airlines, map }) {

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

    // Keep the airline name for the hover tooltip
    label: airline,

    data: years.map(year =>
      map[year]?.[airline] || 0
    ),

    // All stacked sections use the same yellow
    backgroundColor: YELLOW,

    // Contrasting border separates each airline
    borderColor: YELLOW_BORDER,

    borderWidth: 1
  }));


chart = new Chart(ctx, {

    type: "bar",

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

  /*
   * ---------------------------------------------------
   * CHART TITLE
   * ---------------------------------------------------
   */

  title: {
    display: true,
    text: "Flights per Year per Airline",

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


  /*
   * ---------------------------------------------------
   * CHART SUBTITLE
   * ---------------------------------------------------
   */

  subtitle: {
    display: true,
    text: "Number of flights by airline each year",

    color: "rgba(255,255,255,0.55)",

    font: {
      size: 13,
      weight: "400"
    },

    padding: {
      top: 0,
      bottom: 18
    }
  },


  legend: {
    display: false
  },


 
      tooltip: {
      
        // IMPORTANT:
        // Only show the individual stacked segment
        // that the mouse is actually hovering over.
        mode: "nearest",
        intersect: true,
      
        callbacks: {
      
          title(context) {
            // Keep the year as the tooltip heading
            return context[0]?.label || "";
          },
      
          label(context) {
      
            const value =
              Number(context.raw) || 0;
      
            if (!value) return null;
      
            return `${context.dataset.label}: ${value} flights`;
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
      `[airline stats] loaded ${data.length} rows`
    );

    render(
      aggregate(data)
    );

  }
);
