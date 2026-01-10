function showFlightSummary(flight) {
  // Hide other top UI
  document.getElementById("glassBar")?.classList.add("hidden");
  document.getElementById("airportSummaryBar")?.classList.add("hidden");

  // Show flight bar
  const bar = document.getElementById("flightSummaryBar");
  if (!bar) return;
  bar.classList.remove("hidden");

  // Populate fields (see section ② below)
  populateFlightSummary(flight);
}

function hideFlightSummary() {
  document.getElementById("flightSummaryBar")?.classList.add("hidden");

  // Restore default bar
  document.getElementById("glassBar")?.classList.remove("hidden");
}
