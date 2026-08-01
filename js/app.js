// =====================================================
// APPLICATION STARTUP
// =====================================================

async function initialiseApplication() {

  hideSubCountryBorders();
  hideCityLabels();

  /*
   * loadFilters()
   *   • loads available filter values
   *   • applies default selections
   *   • builds the filter UI
   *   • performs the first loadRoutes()
   */
  await loadFilters();
}

map.on("load", initialiseApplication);
