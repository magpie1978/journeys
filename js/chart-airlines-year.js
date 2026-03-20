/* global Chart, sb */

let chart;

function year4(v) {
  return String(v).slice(0, 4);
}

async function loadData() {
  const { data } = await sb
    .from("journeys_routes_core_mv")
    .select("year, airline, journey_type, journey_distance");

  return data || [];
}

// ===== Airlines per year =====
function airlinesPerYear(data) {
  const map = {};

  data.forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const y = year4(r.year);
    map[y] ??= new Set();
    map[y].add(r.airline);
  });

  const years = Object.keys(map).sort();

  return {
    labels: years,
    values: years.map(y => map[y].size)
  };
}

// ===== Flights / Miles per airline =====
function metricPerAirline(data, metric) {
  const map = {};

  data.forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    const val = metric === "miles"
      ? Number(r.journey_distance) || 0
      : 1;

    map[r.airline] = (map[r.airline] || 0) + val;
  });

  const airlines = Object.keys(map).sort((a, b) => map[b] - map[a]);

  return {
    labels: airlines,
    values: airlines.map(a => map[a])
  };
}

function render({ labels, values }, horizontal = true) {
  const ctx = document.getElementById("flightsPerAirlineYearChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values
      }]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadData();
  const select = document.getElementById("airlineMetricSelect");

  function update() {
    const metric = select.value;

    if (metric === "airlines") {
      render(airlinesPerYear(data), false);
    } else {
      render(metricPerAirline(data, metric), true);
    }
  }

  update();
  select.addEventListener("change", update);
});
