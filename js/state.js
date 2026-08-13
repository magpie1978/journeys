// =====================================================
// STATE.JS
// Shared application and filter state
// =====================================================


// =====================================================
// APPLICATION STATE
// =====================================================

window.appState =
  window.appState || {
    mode: "routes",
    isolatedUid: null,
    activeAirport: null
  };


// Ensure all expected properties exist if another file
// created appState before this one loaded.
if (!("mode" in window.appState)) {
  window.appState.mode = "routes";
}

if (!("isolatedUid" in window.appState)) {
  window.appState.isolatedUid = null;
}

if (!("activeAirport" in window.appState)) {
  window.appState.activeAirport = null;
}


// =====================================================
// ROUTE COLLECTIONS
// =====================================================

window.allRoutes =
  Array.isArray(window.allRoutes)
    ? window.allRoutes
    : [];

window.currentRoutes =
  Array.isArray(window.currentRoutes)
    ? window.currentRoutes
    : [];


// =====================================================
// FILTER SELECTIONS
// =====================================================

const selected = {
  years: new Set(),
  airlines: new Set(),
  types: new Set(),
  airports: new Set(),
  cabins: new Set()
};
