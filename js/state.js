// =====================================================================
// STATE
// =====================================================================
let currentRoutes = [];          // Holds the currently loaded + filtered routes from Supabase.
let isolatedUid = null;          // Stores the UID of the currently “isolated” route (clicked in map or sidebar).
let mapMode = "routes";          // defaults map to routes 
let lastNonIsolatedView = null;  // Used to restore map position after: Route isolation or Mode switching
let lastRoutesBounds = null;     // for “revert to prior view” after isolate

// Holds active filter selections  -  Using Set avoids duplicates and makes add/remove trivial
const selected = {
  years: new Set(),
  airlines: new Set(),
  types: new Set(),
};


// =====================================================
// DOM ELEMENTS   -   Caches references to frequently accessed DOM elements: Sidebar, Flight list, Buttons, “Glass counter” UI boxes.  This avoids repeated DOM queries later.
// =====================================================
const sidebar = document.getElementById("sidebar");
const flightListEl = document.getElementById("flightList");
const sidebarToggle = document.getElementById("sidebarToggle");
const reloadBtn = document.getElementById("reloadBtn");

// Glass boxes
const journeyBox = document.getElementById("journeyCounter");
const milesBox = document.getElementById("milesCounter");
const countriesBox = document.getElementById("countriesCounter");
const airlinesBox = document.getElementById("airlinesCounter");
const durationBox = document.getElementById("durationCounter");

// Numbers insode glass boxes
const journeyNumberEl = journeyBox?.querySelector(".glass-number");
const journeyLabelEl = journeyBox?.querySelector(".glass-label");
const milesNumberEl = milesBox?.querySelector(".glass-number");
const countriesNumberEl = countriesBox?.querySelector(".glass-number");
const airlinesNumberEl = airlinesBox?.querySelector(".glass-number");
const durationNumberEl = durationBox?.querySelector(".glass-number");
const airlinesPanel = document.getElementById("airlinesPanel");
const airlinesListEl = document.getElementById("airlinesList");
