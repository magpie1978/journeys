/* global Chart, sb */

let chart;
let countryStats = null;
let selectedCountry = null;
let overviewScrollTop = 0;
let allJourneys = [];
let enabledTypes = new Set();
const TYPE_NAMES = {flight:"Flight",drive:"Drive",train:"Train",bus:"Bus",boat:"Boat",walk:"Walk"};
const typeKey = value => String(value || "").trim().toLowerCase();
function refreshCountryStats() {
  countryStats = visitsPerCountry(allJourneys);
  render(countryStats);
  if (selectedCountry === null) {
    const scroller = document.querySelector(".chart-container.scroll-y");
    if (scroller) scroller.scrollTop = overviewScrollTop;
  }
}
function setupJourneyTypes(data) {
  const counts = new Map();
  data.forEach(r => {
    const type = typeKey(r.journey_type);
    if (type) counts.set(type, (counts.get(type) || 0) + 1);
  });
  const sorted = [...counts.keys()].sort((a,b) =>
    (Object.keys(TYPE_NAMES).indexOf(a) < 0 ? 99 : Object.keys(TYPE_NAMES).indexOf(a)) -
    (Object.keys(TYPE_NAMES).indexOf(b) < 0 ? 99 : Object.keys(TYPE_NAMES).indexOf(b)) || a.localeCompare(b));
  enabledTypes = new Set(sorted);
  const menu = document.getElementById("journeyTypeMenu");
  const trigger = document.getElementById("journeyTypeTrigger");
  const panel = document.getElementById("journeyTypePanel");
  const choices = document.getElementById("journeyTypeChoices");
  if (!menu || !trigger || !panel || !choices) return;
  choices.replaceChildren();
  sorted.forEach(type => {
    const label = document.createElement("label");
    label.className = "journey-type-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = type;
    input.checked = true;
    input.addEventListener("change", () => {
      if (input.checked) enabledTypes.add(type);
      else enabledTypes.delete(type);
      updateLabel(); refreshCountryStats();
    });
    label.append(input, document.createTextNode(" " + (TYPE_NAMES[type] || type) + " (" + counts.get(type) + ")"));
    choices.append(label);
  });
  function updateLabel() {
    trigger.textContent = `Journey Types (${enabledTypes.size}/${sorted.length}) ▾`;
  }
  updateLabel();
  trigger.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    trigger.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.getElementById("journeyTypesAll")?.addEventListener("click", () => {
    enabledTypes = new Set(sorted);
    choices.querySelectorAll("input").forEach(el => el.checked = true);
    updateLabel(); refreshCountryStats();
  });
  document.getElementById("journeyTypesNone")?.addEventListener("click", () => {
    enabledTypes.clear();
    choices.querySelectorAll("input").forEach(el => el.checked = false);
    updateLabel(); refreshCountryStats();
  });
  document.addEventListener("click", e => {
    if (!menu.contains(e.target)) {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }
  });
}


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
      chart.options.indexAxis === "x" ? "center" : "left";

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
          chart.options.indexAxis === "x" ? bar.x : bar.x + 7,
          chart.options.indexAxis === "x" ? bar.y - 9 : bar.y
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


  // Resolve codes and human-readable location names for every transport type.
  const { data: locations, error: locationsError } = await sb
    .from("journey_locations")
    .select("airport_code, airport, city, country, country_code, category");

  if (locationsError) {
    console.error("[country stats] location load failed:", locationsError);
    return [];
  }

  const normalize = value => String(value ?? "")
    .normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

  // Store candidates rather than overwriting duplicate codes or names.
  const byCode = new Map();
  const byName = new Map();
  const byCity = new Map();
  const add = (map, key, location) => {
    const normalized = normalize(key);
    if (!normalized) return;
    if (!map.has(normalized)) map.set(normalized, []);
    map.get(normalized).push(location);
  };

  (locations || []).forEach(location => {
    if (!location.country) return;
    add(byCode, location.airport_code, location);
    add(byName, location.airport, location);
    add(byCity, location.city, location);
  });

  function resolveCountry(place, journeyType) {
    const key = normalize(place);
    if (!key) return null;

    // Prefer exact codes; only try names if no code exists.
    let matches = byCode.get(key) || byName.get(key) || byCity.get(key) || [];

    // e.g. "Geneva Airport" -> "Geneva" if the full name is absent.
    // This is only accepted when all matching locations agree on country.
    if (!matches.length && key.endsWith(" airport")) {
      const shortName = key.slice(0, -8).trim();
      matches = byName.get(shortName) || byCity.get(shortName) || [];
    }
    if (!matches.length) return null;

    // When the same name exists in multiple categories, prefer the
    // category corresponding to this journey's transport type.
    const kind = normalize(journeyType);
    const sameType = matches.filter(location => {
      const category = normalize(location.category);
      return category === kind ||
        (kind === "flight" && category === "airport") ||
        (kind === "train" && category === "train station") ||
        (kind === "bus" && category === "bus station");
    });
    if (sameType.length) matches = sameType;

    // A matching name is safe only if every candidate identifies the same
    // country. Prefer ISO codes so spelling/capitalisation cannot split it.
    const countryIds = [...new Set(matches.map(x =>
      normalize(x.country_code) || normalize(x.country)
    ))];
    if (countryIds.length !== 1 || !countryIds[0]) {
      console.warn("[country stats] ambiguous location:", place, matches);
      return null;
    }
    const canonical = matches.find(x => x.country && x.country.trim());
    return canonical ? {
      id: countryIds[0],
      name: canonical.country.trim()
    } : null;
  }

  const enriched = (journeys || []).map(journey => ({
    ...journey,
    origin_country: resolveCountry(journey.origin, journey.journey_type),
    destination_country: resolveCountry(journey.destination, journey.journey_type)
  }));

  const missing = enriched.filter(r =>
    !r.origin_country || !r.destination_country
  );
  console.info(`[country stats] journeys with unresolved endpoints: ${missing.length}`);
  if (missing.length) console.table(missing.slice(0, 30).map(r => ({
    type: r.journey_type, origin: r.origin, destination: r.destination,
    originResolved: Boolean(r.origin_country),
    destinationResolved: Boolean(r.destination_country)
  })));
  return enriched;
}


// =====================================================
// VISITS PER COUNTRY
// =====================================================

function visitsPerCountry(data) {

  const map = {};
  const yearsSet = new Set();


  // All calendar years represented in the database, even when a
  // particular country has no visits in those years.
  data.forEach(r => {
    const dbYear = String(r.year ?? "").slice(0, 4);
    if (/^\d{4}$/.test(dbYear)) yearsSet.add(dbYear);
  });

  data.forEach(r => {

    const journeyType =
      String(r.journey_type || "")
        .trim()
        .toLowerCase();


    // User-selectable transport modes (including non-flight journeys).
    if (!enabledTypes.has(journeyType)) return;

    // An international arrival requires TWO verified endpoints.
    // Unknown origins must never be mistaken for a border crossing.
    if (!r.origin_country || !r.destination_country) return;

    const originId = r.origin_country.id;
    const destinationId = r.destination_country.id;
    if (!originId || !destinationId) return;

    // Domestic travel does not count as a country visit.
    if (originId === destinationId) return;

    // Preserve the existing exclusion of UK arrivals.
    if (destinationId === "gb" || destinationId === "uk" ||
        String(r.destination_country.name).trim().toLowerCase() === "united kingdom") return;

    const year =
      String(r.year || "").slice(0, 4);


    if (!/^\d{4}$/.test(year)) {
      return;
    }


    const country =
      r.destination_country.name;


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


// Identify clicks on actual country labels, including their left-side gutter.
function countryLabelIndexAt(event, activeChart) {
  const scale = activeChart.scales.y;
  if (!scale || selectedCountry !== null) return -1;
  const x = event.x, y = event.y;
  const labelBoundary = activeChart.chartArea.left;
  if (x == null || y == null || x < 0 || x >= labelBoundary ||
      y < scale.top || y > scale.bottom) return -1;
  // The category scale typically starts at x=0; its RIGHT edge
  // (chartArea.left), not scale.left, bounds the label gutter.
  const ticks = scale.getTicks();
  if (!ticks.length) return -1;
  let closest = -1, distance = Infinity;
  for (let i = 0; i < ticks.length; i++) {
    const d = Math.abs(y - scale.getPixelForTick(i));
    if (d < distance) { distance = d; closest = i; }
  }
  const spacing = ticks.length > 1 ?
    Math.abs(scale.getPixelForTick(1) - scale.getPixelForTick(0)) : 34;
  return distance <= Math.max(10, spacing * 0.45) ? closest : -1;
}

// =====================================================
// RENDER CHART
// =====================================================

function render({
  labels,
  years,
  byCountry
}) {
  const detail = selectedCountry !== null;
  // Display every year from the earliest to latest database year,
  // including years with zero visits for the selected country.
  const visibleYears = years.length
    ? Array.from({ length: Number(years[years.length - 1]) - Number(years[0]) + 1 },
        (_, i) => String(Number(years[0]) + i))
    : [];
  const chartLabels = detail ? visibleYears : labels;
  const backButton = document.getElementById("backToCountries");
  const hint = document.getElementById("countryChartHint");
  if (backButton) backButton.hidden = !detail;
  if (hint) hint.hidden = detail;

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
        (detail ? 0 : chartLabels.length * ROW_HEIGHT)
      );
  
  
    // Keep the country overview scrollable, but fit the yearly chart
    // entirely within the visible panel (including its year labels).
    const chartViewport = chartInner.closest(".chart-container.scroll-y");
    if (chartViewport) {
      chartViewport.classList.toggle("country-detail-view", detail);
      chartViewport.scrollTop = detail ? 0 : chartViewport.scrollTop;
    }
    chartInner.style.height = detail ? "560px" : `${requiredHeight}px`;
  
  
    /*
     * Destroy the previous chart before drawing another.
     */
  
    if (chart) {
      chart.destroy();
    }
  
    const datasets = detail ? [{
      label: "Visits",
      data: visibleYears.map(year => byCountry[selectedCountry]?.[year] || 0),
      backgroundColor: YELLOW,
      borderColor: YELLOW_BORDER,
      borderWidth: 1,
      categoryPercentage: 0.82,
      barPercentage: 0.90
    }] : years.map(year => ({
      label: year,
      data: labels.map(country => byCountry[country]?.[year] || 0),
      backgroundColor: YELLOW,
      borderColor: YELLOW_BORDER,
      borderWidth: 1,
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
    
      labels: chartLabels,
    
      datasets
    
    },

    options: {

      indexAxis: detail ? "x" : "y",
      // Chart.js places Y-axis label text to the LEFT of yScale.left.
      // Use the full label gutter, not the plot area, for hit testing.
      onHover(event, elements, activeChart) {
        const labelIndex = countryLabelIndexAt(event, activeChart);
        activeChart.canvas.style.cursor = !detail &&
          (labelIndex !== -1 || elements.length > 0) ? "pointer" : "default";
      },
      onClick(event, elements, activeChart) {
        if (detail) return;
        const labelIndex = countryLabelIndexAt(event, activeChart);
        const index = labelIndex !== -1 ? labelIndex :
          (elements.length ? elements[0].index : -1);
        if (index < 0 || index >= labels.length) return;
        const scroller = document.querySelector(".chart-container.scroll-y");
        overviewScrollTop = scroller?.scrollTop || 0;
        selectedCountry = labels[index];
        render(countryStats);
        if (scroller) scroller.scrollTop = 0;
      },

      responsive: true,
      maintainAspectRatio: false,


      plugins: {

      title: {
        display: true,
        text: detail ? `Visits per Year — ${selectedCountry}` : "Visits per Country",
      
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

      return detail ? String(items[0].label) : String(items[0].dataset.label);
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
      if (detail) return "";

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
        
          stacked: !detail,
        
          beginAtZero: !detail,
        
          grace: detail ? 0 : "8%",
        
          ticks: {
        
            precision: 0,
            callback(value) {
              return detail ? String(chartLabels[value] ?? "") : Number(value).toLocaleString();
            }
        
          },
        
          grid: {
            color: GRID
          }
        
        },
        
        y: {
        
          stacked: !detail,
          display: !detail,
          beginAtZero: detail,
          grace: detail ? "20%" : 0,
          ticks: detail ? { precision: 0, stepSize: 1 } : {},
        
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


    allJourneys = data;
    setupJourneyTypes(data);
    const stats =
      visitsPerCountry(data);


    console.log(
      `[country stats] ${stats.labels.length} countries`
    );


    countryStats = stats;
    document.getElementById("backToCountries")?.addEventListener("click", () => {
      selectedCountry = null;
      render(countryStats);
      document.querySelector(".chart-container.scroll-y").scrollTop = overviewScrollTop;
    });
    render(stats);

  }
);
