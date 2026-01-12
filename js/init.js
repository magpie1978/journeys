/* global map */

map.on("load", async () => {
  hideSubCountryBorders();
  hideCityLabels();

  // ✅ loadFilters will set defaults AND trigger the initial loadRoutes()
  await loadFilters();
});
