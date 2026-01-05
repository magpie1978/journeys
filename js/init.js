/* global map */

map.on("load", async () => {
  hideSubCountryBorders();
  hideCityLabels();
  await loadFilters();
  await loadRoutes();
});
