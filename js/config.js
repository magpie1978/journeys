/* global supabase, mapboxgl */

// =====================================================
// APPLICATION CONFIGURATION
// =====================================================
//
// Central configuration shared by the application's
// JavaScript modules.
//
// Provides:
//   • Supabase connection and client.
//   • Mapbox access token.
//   • Maximum route-query size.
//   • Operator/transport logo mappings.
//   • Generic transport placeholder icons.
//   • Airport groups used by airport filtering.
//
// =====================================================


// =====================================================
// SUPABASE
// =====================================================

// Public Supabase project URL and anonymous browser key.
//
// The anon key is intentionally client-side. Database
// security must be enforced through Supabase RLS/policies,
// rather than by treating this key as secret.
const SUPABASE_URL =
  "https://jxmyetsjqkrluxqtevxy.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bXlldHNqcWtybHV4cXRldnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzI2NjYsImV4cCI6MjA4MDYwODY2Nn0.YoXEtsY_Zh1Eeuj0kl11AOaj01VrZzGGKoPhJyQP-iU";

const sb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// =====================================================
// MAPBOX
// =====================================================

// Public Mapbox token used by the browser to render the
// map, styles and vector tiles.
mapboxgl.accessToken =
  "pk.eyJ1IjoiY2hyaXMtZHVuaWdhbiIsImEiOiJjbWo4dDRtbGowM25lM2VzYWV0eHhocHp5In0.kO8gJyPmFLqQhz-kTTDyIQ";


// =====================================================
// ROUTE LOADING
// =====================================================

// Maximum number of route records requested at once.
const MAX_ROUTES = 1000;


// =====================================================
// OPERATOR LOGOS
// =====================================================

// Base directory containing airline and transport logos.
const AIRLINE_LOGO_BASE = "tailfins/";

/*
 * Maps the operator name stored in the database to the
 * corresponding image filename in AIRLINE_LOGO_BASE.
 */
const airlineLogoMap = {
  // Airlines
  "Aegean": "Aegean.webp",
  "Aer Lingus": "AerLingus.webp",
  "Air Asia": "AirAsia.webp",
  "Alaska Airways": "Alaska.webp",
  "American Airlines": "American.webp",
  "BA CityFlyer": "BritishAirways.webp",
  "British Airways": "BritishAirways.webp",
  "EasyJet": "easyJet.webp",
  "Brussels Airlines": "Brussels.webp",
  "Buzz": "BuzzRyanair.webp",
  "Cathay Pacific": "CathayPacific.webp",
  "Delta Airlines": "Delta.webp",
  "EasyJet": "easyJet.webp",
  "Emirates": "Emirates.webp",
  "Eurowings": "Eurowings.webp",
  "Finnair": "Finnair.webp",
  "FlyBe": "FlyBe.webp",
  "GOL": "Gol.webp",
  "Iberia": "Iberia.webp",
  "ITA Airways": "ITA.webp",
  "Jet2.com": "Jet2.webp",
  "Jetstar": "Jetstar.webp",
  "Lufthansa": "Lufthansa.webp",
  "Malaysia Airlines": "Malaysian.webp",
  "Monarch": "Monarch.webp",
  "Norwegian": "Norwegian.webp",
  "Olympic": "Olympic.webp",
  "Open Skies": "BritishAirways.webp",
  "Qantas": "Qantas.webp",
  "Qatar Airways": "QatarAirways.webp",
  "Ryanair": "Ryanair.webp",
  "SAS": "SAS.webp",
  "Singapore Airlines": "SingaporeAirlines.webp",
  "Stobart Air": "AerLingus.webp",
  "Swiss": "Swiss.webp",
  "Thompson": "Thompson.webp",
  "TUI": "TUI.webp",
  "Turkish Airlines": "TurkishAirlines.webp",
  "Unknown": "unknown.webp",
  "Virgin Atlantic": "VirginAtlantic.webp",
  "Virgin Australia": "VirginAustralia.webp",
  "Virgin Blue": "VirginAustralia.webp",
  "Volotea": "Volotea.webp",
  "WestJet": "WestJet.webp",
  "Wizz Air": "WizzAir.webp",
  "Volaris Costa Rica": "VolarisCostaRica.webp",
  "Vueling": "Vueling.webp",

  /// Buses
  "FlixBus": "Flix.webp",

  // Trains
  "Arriva": "arriva.png",
  "České dráhy": "czechrailway.png",
  "Comboios de Portugal": "portugalrail.png",
  "DB": "db.png",
  "Eurostar": "eurostar.png",
  "Greater Anglia": "greateranglia.png",
  "GWR": "gwr.png",
  "Iarnród Éireann": "irishrail.png",
  "LNER": "lner.png",
  "Northern": "northern.webp",
  "MÁV": "hungarianrail.png",
  "OBB": "obb.webp",
  "PKP": "pkp.svg",
  "RENFE": "renfe.png",
  "SBB": "sbb.png",
  "SJ": "sj.png",
  "SNCF": "sncf.png",
  "Trenitalia": "trenitalia.png",
  "TransPennine": "transpennine.png",
  "Vietnam Railways": "vietnamrailways.png",
  "Virgin Trains": "virgintrains.png"
};


// =====================================================
// GENERIC TRANSPORT ICONS
// =====================================================

// Used when a journey type does not have a specific
// operator logo.
const placeholderIcons = {
  drive: `${AIRLINE_LOGO_BASE}drive.png`,
  train: `${AIRLINE_LOGO_BASE}train.png`,
  walk: `${AIRLINE_LOGO_BASE}walk.png`,
  boat: `${AIRLINE_LOGO_BASE}boat.png`,
  bus: `${AIRLINE_LOGO_BASE}bus.png`
};


// =====================================================
// OPERATOR LOGO LOOKUP
// =====================================================

/**
 * Returns the logo path for an operator.
 *
 * Returns null when no operator-specific logo is configured,
 * allowing the caller to use a generic transport icon.
 *
 * @param {string} airline
 * @returns {string|null}
 */
function getAirlineLogo(airline) {
  const filename = airlineLogoMap[airline];

  return filename
    ? `${AIRLINE_LOGO_BASE}${filename}`
    : null;
}


// =====================================================
// AIRPORT GROUPS
// =====================================================

// Groups airports that serve the same metropolitan area.
// These groups allow related airports to be treated
// together by airport filtering where required.
const AIRPORT_GROUPS = {
  London: [
    "LHR",
    "LGW",
    "LCY",
    "SEN",
    "LTN",
    "STN"
  ],

  Berlin: [
    "BER",
    "SXF",
    "TXL"
  ],

  Milan: [
    "MXP",
    "BGY",
    "LIN"
  ],

  Bangkok: [
    "BKK",
    "DMK"
  ],

  "New York": [
    "JFK",
    "LGA",
    "EWR"
  ],

  Washington: [
    "IAD",
    "DCA",
    "BWI"
  ],

  Rome: [
    "CIA",
    "FCO"
  ],

  Paris: [
    "ORY",
    "BVA",
    "CDG"
  ]
};
