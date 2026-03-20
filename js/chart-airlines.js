/* global Chart, sb */

let chart;

function year4(v) {
  return String(v).slice(0, 4);
}

async function loadData() {
  const { data } = await sb
    .from("journeys_routes_core_mv")
    .select("journey_type, airline");

  return data || [];
}

function aggregate(data) {
  const map = {};

  data.forEach(r => {
    if (r.journey_type !== "Flight") return;
    if (!r.airline) return;

    map[r.airline] = (map[r.airline] || 0) + 1;
  });

  const airlines = Object.keys(map).sort((a, b) => map[b] - map[a]);

  return {
    labels: airlines,
    values: airlines.map(a => map[a])
  };
}

function render({ labels, values }) {
  const ctx = document.getElementById("airlinesChart");

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
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await loadData();
  render(aggregate(data));
});
