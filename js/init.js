/* global map */

map.on("load", async () => {
  hideSubCountryBorders();
  hideCityLabels();
  await loadFilters(); // loadRoutes() is triggered INSIDE this
});
