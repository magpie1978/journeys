function showFlightSummary(flight) {
  document.getElementById("flightSummaryBar").classList.remove("hidden");
  document.getElementById("airportSummaryBar").classList.add("hidden");

  document.getElementById("flightDate").textContent =
    new Date(flight.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  document.getElementById("flightOrigin").textContent = flight.origin;
  document.getElementById("flightDestination").textContent = flight.destination;

  document.getElementById("originCountry").textContent = flight.origin_country;
  document.getElementById("destinationCountry").textContent = flight.destination_country;

  document.getElementById("flightNumber").textContent = flight.flight_number;
  document.getElementById("flightAirline").textContent = flight.airline;

  document.getElementById("flightDuration").textContent = flight.duration;
  document.getElementById("flightDistance").textContent =
    Math.round(flight.journey_distance) + " mi";
}

function hideFlightSummary() {
  document.getElementById("flightSummaryBar").classList.add("hidden");
}
