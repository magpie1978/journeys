// =====================================================
// STATE.JS
// =====================================================
//
// Central store for shared application state.
//
// This file should be loaded before modules that read or
// modify route, map or filter state.
//
// Provides:
//   • Map mode and route-selection state.
//   • Active airport selection.
//   • Complete and currently displayed route collections.
//   • Top-bar filter selections.
//
// =====================================================


// =====================================================
// APPLICATION STATE
// =====================================================

/*
 * State shared between the map, route, airport and
 * summary-bar modules.
 *
 * mode
 *   Current map display mode: "routes" or "countries".
 *
 * isolatedUid
 *   UID of the single journey currently selected.
 *   Null when no single journey is isolated.
 *
 * selectedUids
 *   Set of all currently selected journey UIDs.
 *   Supports both single and multiple route selection.
 *
 * activeAirport
 *   Airport code selected directly on the map.
 */
window.appState = window.appState || {
  mode: "routes",
  isolatedUid: null,
  selectedUids: new Set(),
  activeAirport: null
};


// Ensure all expected properties exist if appState was
// created by another script before state.js was loaded.

if (!("mode" in window.appState)) {
  window.appState.mode = "routes";
}

if (!("isolatedUid" in window.appState)) {
  window.appState.isolatedUid = null;
}

if (!(window.appState.selectedUids instanceof Set)) {
  window.appState.selectedUids = new Set();
}

if (!("activeAirport" in window.appState)) {
  window.appState.activeAirport = null;
}


// =====================================================
// ROUTE COLLECTIONS
// =====================================================

/*
 * allRoutes
 *   Complete route collection produced by the current
 *   top-bar filters.
 *
 * currentRoutes
 *   Routes currently displayed on the map. This may be
 *   a subset of allRoutes when an airport is selected.
 */

window.allRoutes = Array.isArray(window.allRoutes)
  ? window.allRoutes
  : [];

window.currentRoutes = Array.isArray(window.currentRoutes)
  ? window.currentRoutes
  : [];


// =====================================================
// FILTER SELECTIONS
// =====================================================

/*
 * Current selections made using the top-bar filters.
 *
 * Sets are used because each filter may contain multiple
 * selected values and duplicate selections are unwanted.
 */
const selected = {
  years: new Set(),
  airlines: new Set(),
  types: new Set(),
  airports: new Set(),
  cabins: new Set()
};
