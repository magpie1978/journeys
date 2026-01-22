// ---------------------------------------------------------------------------------------------
// DECLARE GLOBAL VARIABLES
//
// What it does
//     Tells linters / editors that Chart (Chart.js) and sb (Supabase client) are global variables.
// Why
//    You’re loading Chart.js and Supabase via <script> tags, not ES modules.
//    Prevents “undefined variable” warnings.
// ---------------------------------------------------------------------------------------------


/* global Chart, sb */   


// ---------------------------------------------------------------------------------------------
//  LATEST FIXES
// ---------------------------------------------------------------------------------------------
//
//  Right-hand chart:
//     - Scrollbar is permanent (overflowY: scroll)
//     - Only ~top 20 airlines visible at once (configurable)
//     - Airlines sorted by total flights (DESC)
//     - Chart fills the allocated panel width
//     - Canvas height is "tall" (all airlines) so scrolling happens in parent
//     - Bars are stacked by YEAR (all segments same yellow + thin border between segments)

//  Bottom-left chart:
//     - Restored + always rendered
//     - Uses ALL airlines so yearly totals match the top-left chart
//     - Stacked by airline (same yellow + thin borders)

//  Prevent “cut off” axes:
//     - Adds chart layout padding (bottom/left/right)
// ---------------------------------------------------------------------------------------------



// -----------------------------------------------------
// GLOBAL CHART.JS FONT DETAILS
//   Sets global defaults for all charts.
//   Avoids repeating font config in every chart.
//   Guarantees visual consistency across all panels.
// -----------------------------------------------------

    Chart.defaults.font.family =
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
    Chart.defaults.font.size = 12;
    Chart.defaults.font.weight = "400";
    Chart.defaults.color = "#ccc";


// ------------------------------------------------------------------------------
// GLOBAL STATE
//   Stores:
//     Raw data (baseStatsData)
//     Current toggle state (viewMode)
//     References to active Chart.js instances
//  Why:
//     Chart.js must destroy old charts before creating new ones.
//     Keeping references avoids memory leaks and “canvas already in use” bugs.
// -------------------------------------------------------------------------------

    let baseStatsData = [];
    let viewMode = "year"; // "year" | "alltime"
    
    let yearChart = null;             // top-left
    let airlineStackedChart = null;   // bottom-left
    let airlineByYearChart = null;    // right


// --------------------------------------------------------------------------------------
// VISUAL AND LAYOUT CONSTANTS
//    Centralises colours so that if you tweak the “gold” once, it updates everywhere.
//    Makes stacked charts visually consistent.
//
//    Also controls: 
//      Height per airline row
//      How many airlines are visible without scrolling
//   
//    This is the core of the right-hand scrollbar logic.
//    The chart itself is tall → the container scrolls.
// -----------------------------------------------------------------------------------------

    const YELLOW = "rgba(201,162,77,0.7)";
    const YELLOW_BORDER = "rgba(201,162,77,0.9)";
    const GRID = "rgba(255,255,255,0.08)";
    
    const RIGHT_ROW_HEIGHT = 32;
    const RIGHT_VISIBLE_ROWS = 24;



//
// --------------------------------------------------------------------------------------------
// ADD END LABEL PLUGIN
//
//   This plugin draws total flight counts at the end of each horizontal bar by:
//   After Chart.js finishes drawing:
//     Loops over each airline (y-axis label)
//     Sums all stacked dataset values for that row
//     Draws text slightly to the right of the bar end

//  This plugin is used becaise Chart.js does not provide built-in “end of bar” labels.
//  This avoids cluttering tooltips and gives instant readability.
// ----------------------------------------------------------------------------------------------

const barEndLabelPlugin = {
  id: "barEndLabels",
  afterDatasetsDraw(chart) {
    const { ctx, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    ctx.save();
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillStyle = "#ccc";
    ctx.textBaseline = "middle";

    // Loop over each airline (y-axis label)
    chart.data.labels.forEach((label, index) => {
      let total = 0;

      // Sum stacked datasets for this row
      chart.data.datasets.forEach(ds => {
        const value = ds.data[index];
        if (typeof value === "number") total += value;
      });

      if (total > 0) {
        const x = xScale.getPixelForValue(total) + 6; // offset right
        const y = yScale.getPixelForTick(index);

        ctx.fillText(total, x, y);
      }
    });

    ctx.restore();
  }
};




//
// ----------------------------------------------------------------------------------------------------------------
// LOAD BASE DATA FROM SUPABASE
//
//   This loads all required fields in one query because we’ve already done the hard work of aggregating in SQL.
//   This keeps the frontend logic fast and simple.

// ----------------------------------------------------------------------------------------------------------------
    async function loadStatsBaseData() {
      const { data, error } = await sb
        .from("journeys_routes_core_mv")
        .select("year, journey_type, journey_distance, airline, destination_country");
    
      if (error) {
        console.error("[stats] load failed", error);
        return [];
      }
      return data || [];
    }



// -----------------------------------------------------------------------------------------
// YEAR PARSING HELPER

//   This extracts a safe YYYY string from:
//     Dates
//     Timestamps
//     Strings
//   in order to prevent:
//     Invalid years
//     Broken charts due to bad data
//
//   This centralises year parsing so all aggregators behave consistently.
// ----------------------------------------------------------------------------------------

    function year4(v) {
      if (v == null) return null;
      const y = String(v).slice(0, 4);
      return /^\d{4}$/.test(y) ? y : null;
    }
// ----------------------------------------------------------------------------------------




// -----------------------------------------------------
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces Flights per Year (top-left chart)
// -----------------------------------------------------

    function flightsPerYear(data) {
      const out = {};
      (data || []).forEach(r => {
        if (r.journey_type !== "Flight") return;
        const y = year4(r.year);
        if (!y) return;
        out[y] = (out[y] || 0) + 1;
      });
      return out;
    }


// -----------------------------------------------------
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces Miles per Year (top-left chart)
// -----------------------------------------------------

    function milesPerYear(data) {
      const out = {};
      (data || []).forEach(r => {
        if (r.journey_type !== "Flight") return;
        const y = year4(r.year);
        if (!y) return;
        out[y] = (out[y] || 0) + (Number(r.journey_distance) || 0);
      });
      return out;
    }


// -----------------------------------------------------
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces cumulative metrics  (top-left chart)
// -----------------------------------------------------

    function cumulative(valuesByYear) {
      const out = {};
      let run = 0;
      Object.keys(valuesByYear)
        .sort()
        .forEach(y => {
          run += valuesByYear[y];
          out[y] = run;
        });
      return out;
    }


// -------------------------------------------------------------------
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces Flight per Year per Airline (bottom-left chart)
// --------------------------------------------------------------------

    function flightsPerYearPerAirline(data) {
      const map = {};
      const airlineTotals = {};
    
      (data || []).forEach(r => {
        if (r.journey_type !== "Flight") return;
        if (!r.airline) return;
    
        const y = year4(r.year);
        if (!y) return;
    
        map[y] ??= {};
        map[y][r.airline] = (map[y][r.airline] || 0) + 1;
    
        airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
      });
    
      const years = Object.keys(map).sort();
    
      // Keep ALL airlines so totals match the top chart, but sort by overall flights (DESC)
      const airlines = Object.entries(airlineTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([airline]) => airline);
    
      const datasets = airlines.map(airline => ({
        label: airline,
        data: years.map(y => map[y]?.[airline] || 0),
      }));
    
      return { years, datasets };
    }


// -------------------------------------------------------------------
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces Flight per Airline by Year (right-hand side chart)
// --------------------------------------------------------------------

    function flightsPerAirlineByYear(data) {
      const map = {};
      const airlineTotals = {};
      const yearsSet = new Set();
    
      (data || []).forEach(r => {
        if (r.journey_type !== "Flight") return;
        if (!r.airline) return;
    
        const y = year4(r.year);
        if (!y) return;
    
        yearsSet.add(y);
    
        map[r.airline] ??= {};
        map[r.airline][y] = (map[r.airline][y] || 0) + 1;
    
        airlineTotals[r.airline] = (airlineTotals[r.airline] || 0) + 1;
      });
    
      const years = Array.from(yearsSet).sort();
    
      // Airlines sorted by TOTAL flights (DESC)
      const airlines = Object.entries(airlineTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([airline]) => airline);
    
      // datasets = years (stacked), labels = airlines
      const datasets = years.map(y => ({
        label: y,
        data: airlines.map(a => map[a]?.[y] || 0),
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1,
        borderSkipped: false,
        stack: "years",
      }));
    
      return { airlines, years, datasets };
    }



// ====================================================================================================
// AGGREGATORS - RAW DATA TO CHART READY STRUCTURES
//
// This produces Visits per Country chart (right-hand side chart)
// ====================================================================================================
    function visitsPerCountry(data) {
      const counts = {};
    
      data
        .filter(r => r.journey_type === "Flight" &&
            r.destination_country &&
            r.destination_country !== "United Kingdom"
          )
              
        .forEach(r => {
          const c = r.destination_country;
          counts[c] = (counts[c] || 0) + 1;
        });
    
      // Sort countries by total visits (desc)
      const countries = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([country]) => country);
    
      return {
        countries,
        values: countries.map(c => counts[c])
      };
    }


// ---------------------------------------------------------------------------
// RENDERERS - TOP LEFT CHART

//   The renderers:
//      Switch between bar and line depending on viewMode
//      Adds extra bottom padding to avoid axis clipping
//      Uses global colour constants
//   in order to keep the chart visually stable when toggling modes.
// -----------------------------------------------------------------------------
    function renderTopLeft(values, metric) {
      const canvas = document.getElementById("flightsByYearChart");
      if (!canvas) return;
    
      if (yearChart) yearChart.destroy();
    
      const labels = Object.keys(values).sort();
      const data = labels.map(y => Math.round(values[y]));
    
      const isAllTime = viewMode === "alltime";
    
      yearChart = new Chart(canvas.getContext("2d"), {
        type: isAllTime ? "line" : "bar",
        data: {
          labels,
          datasets: [
            {
              data,
              tension: 0.3,
              fill: false,
              backgroundColor: YELLOW,
              borderColor: YELLOW_BORDER,
              borderWidth: isAllTime ? 3 : 0,
              pointRadius: isAllTime ? 3 : 0,
              borderRadius: isAllTime ? 0 : 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: "easeOutQuart" },
          layout: { padding: { top: 6, right: 10, bottom: 16, left: 10 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => {
                  const v = ctx.raw;
                  if (metric === "miles") return `${Number(v).toLocaleString()} miles`;
                  return `${Number(v).toLocaleString()}`;
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { grid: { color: GRID }, ticks: { font: { size: 11 } } },
          },
        },
      });
    }


// -------------------------------------------------------------------------------------
// RENDERERS - BOTTOM LEFT CHART

//   The renderers:
//      Switch between bar and line depending on viewMode
//      Adds extra bottom padding to avoid axis clipping
//      Uses global colour constants
//   in order to keep the chart visually stable when toggling modes.
//
//   Additionally this rendered ensures the bars are
//      Always stacked
//      Same yellow styling for all airlines
//      Extra bottom padding (layout.padding.bottom: 24)
//   in order to prevent x-axis labels from being cut off (one of the earlier issues).
// -------------------------------------------------------------------------------------

    function renderBottomLeft({ years, datasets }) {
      const canvas = document.getElementById("flightsPerYearAirlineChart");
      if (!canvas) return;
    
      if (airlineStackedChart) airlineStackedChart.destroy();
    
      airlineStackedChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: years,
          datasets: (datasets || []).map(ds => ({
            ...ds,
            // Force same look for all stacks
            backgroundColor: YELLOW,
            borderColor: YELLOW_BORDER,
            borderWidth: 1,
            borderSkipped: false,
            barPercentage: 0.85,
            categoryPercentage: 0.75,
            stack: "airlines",
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: "easeOutQuart" },
          layout: { padding: { top: 6, right: 12, bottom: 24, left: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: items => `Year ${items[0].label}`,
                label: ctx => `${ctx.dataset.label}: ${ctx.raw} flights`,
              },
            },
          },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { stacked: true, grid: { color: GRID }, ticks: { font: { size: 11 } } },
          },
        },
      });
    }


// ---------------------------------------------------------------------------
// RENDERERS - RIGHT HAND SIDE CHART

//   The renderers:
//      Switch between bar and line depending on viewMode
//      Adds extra bottom padding to avoid axis clipping
//      Uses global colour constants
//   in order to keep the chart visually stable when toggling modes.
//
//   Additionally this rendered ensures the bars are
//      Container logic
//         Fixes visible height to ~24 rows
//         Forces scrollbar to always be visible
//         Disables responsive resizing (manual control)
//
//      Canvas logic
//         Canvas height = airlines.length × row height
//         Canvas width = container width
//         Chart is taller than viewport → container scrolls
//
//      Chart config
//         indexAxis: "y" → horizontal bars
//         Vertical grid lines enabled
//         Dataset spacing controlled via: categoryPercentage: 1.0, barPercentage: 0.9
// -----------------------------------------------------------------------------

    function renderRight({ airlines, datasets }) {
      const canvas = document.getElementById("flightsPerAirlineYearChart");
      if (!canvas) return;
    
      // parent is your .airline-scroll div
      const container = canvas.parentElement;
    
      // Make scrollbar permanent + lock visible height to ~20 rows
      const visibleHeight = RIGHT_VISIBLE_ROWS * RIGHT_ROW_HEIGHT;
      container.style.height = `${visibleHeight}px`;
      container.style.maxHeight = `${visibleHeight}px`;
      container.style.overflowY = "scroll"; // permanent
      container.style.overflowX = "hidden";
      container.style.position = "relative";
    
      // Canvas is tall (all airlines) so container scrolls
      const totalHeight = (airlines?.length || 0) * RIGHT_ROW_HEIGHT;
      canvas.height = Math.max(totalHeight, visibleHeight);
      canvas.style.height = `${Math.max(totalHeight, visibleHeight)}px`;
      canvas.style.width = "100%";
    
      // Ensure canvas drawing width matches container width
      // (important because we set responsive:false)
      const w = container.clientWidth || 800;
      canvas.width = w;
    
      if (airlineByYearChart) airlineByYearChart.destroy();
    
      airlineByYearChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
      
        data: {
          labels: airlines,
          datasets // already styled in flightsPerAirlineByYear()
        },
      
        options: {
          indexAxis: "y",
          responsive: false,
          maintainAspectRatio: false,
    
          scales: {
            x: {
              stacked: true,
              grid: {
                display: true,
                color: "rgba(255,255,255,0.08)", // faint vertical lines
                lineWidth: 1,
                drawBorder: false
              },
              ticks: {
                font: { size: 11 }
              }
            },
            y: {
              stacked: true,
              grid: {
                display: false // keep rows clean
              },
              ticks: {
                autoSkip: false,
                font: { size: 11 },
                padding: 8
              }
            }
          },
      
          datasets: {
            bar: {
              categoryPercentage: 1.0, // fill vertical space
              barPercentage: 0.9
            }
          },
      
          plugins: {
            legend: { display: false },
            barEndLabels: true
          }
        },
        plugins: [barEndLabelPlugin]
      });

      // Reset scroll to top so user sees “top 20” initially
      container.scrollTop = 0;
    } 



// ---------------------------------------------------------------------------
// RENDERERS - COUNTRY VISITS CHART
// -----------------------------------------------------------------------------

        let countryChart = null;
        
        function renderVisitsPerCountry({ countries, values }) {
          const canvas = document.getElementById("visitsPerCountryChart");
          if (!canvas) return;
        
          const ROW_HEIGHT = 30;
          const VISIBLE_ROWS = 20;
        
          const totalHeight = countries.length * ROW_HEIGHT;
          const visibleHeight = VISIBLE_ROWS * ROW_HEIGHT;
        
          // Scroll container
          const scrollContainer = canvas.parentElement;
          scrollContainer.style.height = `${visibleHeight}px`;
          scrollContainer.style.maxHeight = `${visibleHeight}px`;
          scrollContainer.style.overflowY = "auto";
        
          // Canvas must be taller than container
          canvas.height = totalHeight;
          canvas.style.height = `${totalHeight}px`;
        
          const ctx = canvas.getContext("2d");
        
          if (countryChart) countryChart.destroy();
        
          countryChart = new Chart(ctx, {
            type: "bar",
            data: {
              labels: countries,
              datasets: [{
                data: values,
                backgroundColor: YELLOW,
                borderColor: YELLOW_BORDER,
                borderWidth: 1,
                barPercentage: 0.9,
                categoryPercentage: 1.0
              }]
            },
            options: {
              indexAxis: "y",
              responsive: false,          // 🔑 critical for scrolling
              maintainAspectRatio: false,
              animation: false,
        
              scales: {
                x: {
                  grid: { color: GRID },
                  ticks: { precision: 0 }
                },
                y: {
                  grid: { display: false },
                  ticks: { autoSkip: false }
                }
              },
        
              plugins: {
                legend: { display: false }
              }
            }
          });
        }




// -----------------------------------------------------
// METRIC DISPATCH (top-left only)
//
//   Keeps metric switching isolated to one chart.
//   Avoids accidental re-renders of the stacked charts.
// -----------------------------------------------------

    function getTopLeftValues(metric) {
      let yearly;
    
      switch (metric) {
        case "miles":
          yearly = milesPerYear(baseStatsData);
          return viewMode === "alltime" ? cumulative(yearly) : yearly;
    
        case "flights":
        default:
          yearly = flightsPerYear(baseStatsData);
          return viewMode === "alltime" ? cumulative(yearly) : yearly;
      }
    }




// -----------------------------------------------------
// APP INITIALISATION
//
//   What happens
//      Load data
//      Render all three charts
//      Attach event listeners
//      Handle window resize (right chart only)
//
//   Why
//      Clean separation of:
//         Data loading
//         Rendering
//         Interaction
// -----------------------------------------------------

    document.addEventListener("DOMContentLoaded", async () => {
      baseStatsData = await loadStatsBaseData();
    
      const metricSelect = document.getElementById("metricSelector");
      const btnYear = document.getElementById("btnYear");
      const btnAllTime = document.getElementById("btnAllTime");
      const countryData = visitsPerCountry(baseStatsData);
    
    
      // Initial render (all four charts)
      renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
      renderBottomLeft(flightsPerYearPerAirline(baseStatsData));
      renderRight(flightsPerAirlineByYear(baseStatsData));
      renderVisitsPerCountry(countryData);
    
      // Re-render top-left when metric changes
      metricSelect.addEventListener("change", () => {
        renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
      });
    
      // Toggle year/alltime (top-left only)
      btnYear.addEventListener("click", () => {
        viewMode = "year";
        btnYear.classList.add("active");
        btnAllTime.classList.remove("active");
        renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
      });
    
      btnAllTime.addEventListener("click", () => {
        viewMode = "alltime";
        btnAllTime.classList.add("active");
        btnYear.classList.remove("active");
        renderTopLeft(getTopLeftValues(metricSelect.value), metricSelect.value);
      });
    
      // If the right panel is resized (responsive layout), rebuild the right chart width
      window.addEventListener("resize", () => {
        // Only need to re-render right (width is manual)
        renderRight(flightsPerAirlineByYear(baseStatsData));
      });
    });
