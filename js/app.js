/* global map, hideSubCountryBorders, hideCityLabels, loadFilters */

// =====================================================
// APPLICATION STARTUP
// =====================================================
//
// Runs the application's initial setup once the Mapbox
// map has finished loading.
//
// Startup sequence:
//   • Hide unwanted map boundary and city-label layers.
//   • Load filter values and apply their defaults.
//   • Build the filter controls.
//   • Perform the initial route load.
//
// The initial route load is handled by loadFilters(),
// rather than being called separately here.
//
// =====================================================


/**
 * Performs the application's initial setup.
 */
async function initialiseApplication() {
  hideSubCountryBorders();
  hideCityLabels();

  await loadFilters();
}


// Start the application only after the Mapbox map and
// its style are ready for layer manipulation.
map.on("load", initialiseApplication);
