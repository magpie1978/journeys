let flightsChart = null;

// =====================================================
// LOAD BASE DATA (one query for all charts)
// =====================================================
async function loadStatsBaseData() {
  const { data, error } = await sb
    .from("journeys_routes_cache")
    .select("year, journey_type, journey_distance, airline, destination_country");


  if (error) {
    console.error("[stats] load failed", error);
    return [];
  }

  return data || [];
}

// =====================================================
// METRIC BUILDERS
// =====================================================
function flightsPerYear(data) {
  const out = {};

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + 1;
    });

  return out;
}

function milesPerYear(data) {
  const out = {};

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      out[y] = (out[y] || 0) + (Number(r.journey_distance) || 0);
    });

  return out;
}

function airlinesPerYear(data) {
  const map = {};

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      if (!map[y]) map[y] = new Set();
      if (r.airline) map[y].add(r.airline);
    });

  const out = {};
  Object.keys(map).forEach(y => {
    out[y] = map[y].size;
  });

  return out;
}


function countriesPerYear(data) {
  const map = {};

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      if (!r.destination_country) return;

      const y = String(r.year).slice(0, 4);
      if (!map[y]) map[y] = new Set();
      map[y].add(r.destination_country);
    });

  const out = {};
  Object.keys(map).forEach(y => {
    out[y] = map[y].size;
  });

  return out;
}


function flightsPerAirlinePerYear(data) {
  const map = {};
  const yearsSet = new Set();
  const airlinesSet = new Set();

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      if (!r.airline) return;

      const year = String(r.year).slice(0, 4);
      const airline = r.airline;

      yearsSet.add(year);
      airlinesSet.add(airline);

      if (!map[airline]) map[airline] = {};
      map[airline][year] = (map[airline][year] || 0) + 1;
    });

  const years = Array.from(yearsSet).sort();       // ascending
  const airlines = Array.from(airlinesSet).sort(); // alphabetical

  const datasets = years.map((year, i) => ({
    label: year,
    data: airlines.map(a => map[a]?.[year] || 0),
    stack: "years",
  }));

  return { airlines, years, datasets };
}




// =====================================================
// CHART RENDERER (reused for all metrics)
// =====================================================
function renderStatsChart({ title, label, values, color }) {
  const ctx = document
    .getElementById("flightsByYearChart")
    .getContext("2d");

  const years = Object.keys(values).sort();
  const data = years.map(y => values[y]);

  const titleEl = document.getElementById("statsTitle");
  if (titleEl) titleEl.textContent = title;

  if (flightsChart) flightsChart.destroy();

  flightsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [
        {
          label,
          data,
          backgroundColor: color,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#ccc" },
          grid: { display: false },
        },
        y: {
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111",
        },
      },
    },
  });
}


function renderHorizontalStackedStatsChart({ title, labels, datasets }) {
  const canvas = document.getElementById("flightsByYearChart");
  const ctx = canvas.getContext("2d");

  const titleEl = document.getElementById("statsTitle");
  if (titleEl) titleEl.textContent = title;

  // 👉 Make canvas WIDE so X-axis scrolls
  const minWidth = 900;
  const pixelsPerFlight = 4; // controls scroll amount
  const maxFlights = Math.max(
    ...datasets.flatMap(ds => ds.data)
  );

  canvas.width = Math.max(minWidth, maxFlights * pixelsPerFlight);
  canvas.height = 320; // SAME height as other charts

  if (flightsChart) flightsChart.destroy();

  flightsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map(ds => ({
        ...ds,
        backgroundColor: "rgba(201,162,77,0.7)",
        borderRadius: 4,
      })),
    },
    options: {
      indexAxis: "y",
      responsive: false,   // we control size
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          ticks: { color: "#ccc", precision: 0 },
          grid: { color: "rgba(255,255,255,0.05)" },
          title: {
            display: true,
            text: "Flights",
            color: "#ccc",
          },
        },
        y: {
          stacked: true,
          ticks: { color: "#ccc", padding: 8 },
          grid: { display: false },
          title: {
            display: true,
            text: "Airline",
            color: "#ccc",
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111",
          titleColor: "#fff",
          bodyColor: "#ddd",
          callbacks: {
            title(ctx) {
              return ctx[0].label;
            },
            label(ctx) {
              const year = ctx.dataset.label;
              const value = ctx.parsed.x;
              return `${year}: ${value} flight${value !== 1 ? "s" : ""}`;
            },
          },
        },
      },
    },
  });
}

// =====================================================
// DROPDOWN HANDLER
// =====================================================
const statsMetricSelect = document.getElementById("statsMetricSelect");

async function updateStatsChart() {
  const baseData = await loadStatsBaseData();
  const metric = statsMetricSelect?.value || "flights";

  if (metric === "flights") {
    renderStatsChart({
      title: "Flights by Year",
      label: "Flights",
      values: flightsPerYear(baseData),
      color: "rgba(201,162,77,0.7)",
    });
  }

  if (metric === "miles") {
    renderStatsChart({
      title: "Miles Flown by Year",
      label: "Miles",
      values: milesPerYear(baseData),
      color: "rgba(80,170,255,0.7)",
    });
  }

  if (metric === "countries") {
    renderStatsChart({
      title: "Countries Visited by Year",
      label: "Countries",
      values: countriesPerYear(baseData),
      color: "rgba(255,215,0,0.7)",
    });
  }

  if (metric === "airlines") {
    renderStatsChart({
      title: "Airlines Flown by Year",
      label: "Airlines",
      values: airlinesPerYear(baseData),
      color: "rgba(160,220,160,0.7)",
    });
  }

  if (metric === "airlines_years") {
  const { airlines, datasets } = flightsPerAirlinePerYear(baseData);

  renderHorizontalStackedStatsChart({
    title: "Flights by Airline (Stacked by Year)",
    labels: airlines,
    datasets,
  });
  }
}

// =====================================================
// STATS OVERLAY CONTROLS (unchanged, just extended)
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  updateStatsChart();
});


statsMetricSelect?.addEventListener("change", updateStatsChart);

