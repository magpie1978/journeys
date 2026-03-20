/* global Chart, sb */

let flightsChart;

const YELLOW = "rgba(201,162,77,0.7)";
const YELLOW_BORDER = "rgba(201,162,77,0.9)";
const GRID = "rgba(255,255,255,0.08)";

function year4(v) {
  return String(v).slice(0, 4);
}

async function loadData() {
  const { data } = await sb
    .from("journeys_routes_core_mv")
    .select("year, journey_type, journey_distance");

  return data || [];
}

function flightsPerYear(data, metric = "flights") {
  const map = {};

  data.forEach(r => {
    if (r.journey_type !== "Flight") return;

    const y = year4(r.year);
    const val = metric === "miles"
      ? Number(r.journey_distance) || 0
      : 1;

    map[y] = (map[y] || 0) + val;
  });

  const years = Object.keys(map).sort();

  return {
    labels: years,
    values: years.map(y => Math.round(map[y]))
  };
}

function renderChart({ labels, values }) {
  const ctx = document.getElementById("flightsByYearChart");

  if (flightsChart) flightsChart.destroy();

  flightsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: YELLOW,
        borderColor: YELLOW_BORDER,
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: GRID } }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadData();
  renderChart(flightsPerYear(data));
});
