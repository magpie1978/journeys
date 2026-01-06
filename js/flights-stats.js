let flightsChart = null;
let flightsByAirlineChart = null;

// =====================================================
// LOAD BASE DATA
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
// NORMALISATION
// =====================================================
function normaliseAirline(a) {
  if (!a) return "Unknown";

  return a
    .toLowerCase()
    .replace(/\(.*?\)/g, "")           // remove brackets
    .replace(/plc|ltd|limited/gi, "")  // remove legal suffixes
    .replace(/\s+/g, " ")              // collapse spaces
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
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
      map[y].add(normaliseAirline(r.airline));
    });

  const out = {};
  Object.keys(map).forEach(y => (out[y] = map[y].size));
  return out;
}

function countriesPerYear(data) {
  const map = {};
  data
    .filter(r => r.journey_type === "Flight" && r.destination_country)
    .forEach(r => {
      const y = String(r.year).slice(0, 4);
      if (!map[y]) map[y] = new Set();
      map[y].add(r.destination_country);
    });

  const out = {};
  Object.keys(map).forEach(y => (out[y] = map[y].size));
  return out;
}

// =====================================================
// FLIGHTS PER YEAR PER AIRLINE (CORRECT & SAFE)
// =====================================================
function flightsPerAirlinePerYear(data) {
  const map = {};
  const yearsSet = new Set();
  const airlinesSet = new Set();

  data
    .filter(r => r.journey_type === "Flight")
    .forEach(r => {
      const year = String(r.year).slice(0, 4);
      const airline = normaliseAirline(r.airline);

      yearsSet.add(year);
      airlinesSet.add(airline);

      if (!map[airline]) map[airline] = {};
      map[airline][year] = (map[airline][year] || 0) + 1;
    });

  const years = Array.from(yearsSet).sort();
  const airlines = Array.from(airlinesSet).sort();

  const datasets = airlines.map(airline => ({
    label: airline,
    data: years.map(y => map[airline]?.[y] || 0),
    stack: "airlines",
  }));

  return { years, datasets };
}

// =====================================================
// CHART RENDERERS
// =====================================================
function renderStatsChart({ title, label, values, color }) {
  const ctx = document.getElementById("flightsByYearChart").getContext("2d");

  if (flightsChart) flightsChart.destroy();

  const years = Object.keys(values).sort();
  const data = years.map(y => values[y]);

  flightsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [{ label, data, backgroundColor: color, borderRadius: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#ccc" } },
        y: { grid: { color: "rgba(255,255,255,0.08)" }, ticks: { color: "#ccc" } },
      },
    },
  });
}

function renderFlightsPerYearByAirline({ labels, datasets }) {
  const ctx = document
    .getElementById("flightsPerYearAirlineChart")
    .getContext("2d");

  if (flightsByAirlineChart) flightsByAirlineChart.destroy();

  flightsByAirlineChart = new Chart(ctx, {
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
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: "#ccc" } },
        y: { stacked: true, ticks: { color: "#ccc" } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

// =====================================================
// MAIN UPDATE HANDLER (WITH PROOF)
// =====================================================
const statsMetricSelect = document.getElementById("statsMetricSelect");

async function updateStatsChart() {
  const baseData = await loadStatsBaseData();
  const metric = statsMetricSelect?.value || "flights";

  // 🔍 PROOF (safe to remove later)
  const debug2017 = baseData.filter(
    r => r.journey_type === "Flight" && String(r.year).startsWith("2017")
  );

  console.log("2017 total flights:", debug2017.length);
  console.table(
    debug2017.reduce((a, r) => {
      const k = normaliseAirline(r.airline);
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {})
  );

  if (metric === "flights") {
    renderStatsChart({
      title: "Flights by Year",
      label: "Flights",
      values: flightsPerYear(baseData),
      color: "rgba(201,162,77,0.7)",
    });

    const { years, datasets } = flightsPerAirlinePerYear(baseData);
    renderFlightsPerYearByAirline({ labels: years, datasets });
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
}

// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", updateStatsChart);
statsMetricSelect?.addEventListener("change", updateStatsChart);
