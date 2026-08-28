/* global supabase */

const SUPABASE_URL = "https://jxmyetsjqkrluxqtevxy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bXlldHNqcWtybHV4cXRldnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzI2NjYsImV4cCI6MjA4MDYwODY2Nn0.YoXEtsY_Zh1Eeuj0kl11AOaj01VrZzGGKoPhJyQP-iU";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

mapboxgl.accessToken ="pk.eyJ1IjoiY2hyaXMtZHVuaWdhbiIsImEiOiJjbWo4dDRtbGowM25lM2VzYWV0eHhocHp5In0.kO8gJyPmFLqQhz-kTTDyIQ";  /* Mapbox API token for rendering maps and vector tiles */

const MAX_ROUTES = 1000;

const AIRLINE_LOGO_BASE = "tailfins/";
/*const AIRLINE_LOGO_BASE = "https://raw.githubusercontent.com/magpie1978/douzepoints/main/tailfins/"; */

const airlineLogoMap = {
  // Airlines
  "Ryanair": "Ryanair.webp",
  "British Airways": "BritishAirways.webp",
  "EasyJet": "easyJet.webp",
  "Wizz Air": "WizzAir.webp",
  "ITA Airways": "ITA.webp",
  "Aegean": "Aegean.webp",
  "Aer Lingus": "AerLingus.webp",
  "Aerolineas Argentinas": "AerolineasArgentinas.webp",
  "Air Asia": "AirAsia.webp",
  "Alaska Airways": "Alaska.webp",
  "American Airlines": "American.webp",
  "Bamboo Airways": "Bamboo Airways.webp",
  "Brussels Airlines": "Brussels.webp",
  "Buzz": "BuzzRyanair.webp",
  "Cathay Pacific": "CathayPacific.webp",
  "Delta Airlines": "Delta.webp",
  "Emirates": "Emirates.webp",
  "Eurowings": "Eurowings.webp",
  "Finnair": "Finnair.webp",
  "GOL": "Gol.webp",
  "Iberia": "Iberia.webp",
  "Jet2.com": "Jet2.webp",
  "Jetstar": "Jetstar.webp",
  "JetSmart": "JetSmart.webp",
  "Lao Airlines": "LaoAirlines.webp",
  "Lufthansa": "Lufthansa.webp",
  "Malaysia Airlines": "Malaysian.webp",
  "Norwegian": "Norwegian.webp",
  "Qantas": "Qantas.webp",
  "Pacific Airlines": "PacificAirlines.webp",
  "PKP":"pkp.svg",
  "Qatar Airways": "QatarAirways.webp",
  "SAS": "SAS.webp",
  "Singapore Airlines": "SingaporeAirlines.webp",
  "Swiss": "Swiss.webp",
  "TUI": "TUI.webp",
  "Turkish Airlines": "TurkishAirlines.webp",
  "Unknown": "unknown.webp",
  "Virgin Atlantic": "VirginAtlantic.webp",
  "Virgin Australia": "VirginAustralia.webp",
  "Virgin Blue": "VirginAustralia.webp",
  "Volotea": "Volotea.webp",
  "WestJet": "WestJet.webp",
  "Vueling": "Vueling.webp",
  
  //Buses
  "FlixBus": "Flix.webp",
  
  //Trains
  "Arriva":"arriva.png",
  "České dráhyand":"czechrailway.png",
  "Comboios de Portugal":"portugalrail.png",
  "DB":"db.png",
  "Eurostar":"eurostar.png",
  "Greater Anglia":"greateranglia.png",
  "GWR":"gwr.png",
  "Iarnród Éireann":"irishrail.png",
  "LNER":"lner.png",
  "Northern":"northern.webp",
  "MÁV":"hungarianrail.png",
  "OBB":"obb.webp",
  "RENFE":"renfe.png",
  "SBB":"sbb.png",
  "SJ":"sj.png",
  "SNCF":"sncf.png",
  "Trenitalia":"trenitalia.png",
  "TransPennine":"transpennine.png",
  "Vietnam Railways":"vietnamrailways.png",
  "Virgin Trains":"virgintrains.png"
};


const placeholderIcons = {
  drive: AIRLINE_LOGO_BASE + "drive.png",
  train: AIRLINE_LOGO_BASE + "train.png",
  walk: AIRLINE_LOGO_BASE + "walk.png",
  boat: AIRLINE_LOGO_BASE + "boat.png",
  bus: AIRLINE_LOGO_BASE + "bus.png"
};

// =====================================================
// AIRLINE LOGOS (GLOBAL)
// =====================================================
function getAirlineLogo(airline) {
    const filename =
        airlineLogoMap?.[airline];

    return filename
        ? AIRLINE_LOGO_BASE + filename
        : null;
}

// =====================================================
// AIRPORT GROUPS
// =====================================================
const AIRPORT_GROUPS = {
  London: ["LHR","LGW","LCY","SEN","LTN","STN"],
  Berlin: ["BER","SXF","TXL"],
  Milan: ["MXP","BGY","LIN"],
  Bangkok: ["BKK","DMK"],
  'New York': ["JFK","LGA","EWR"],
  Washington: ["IAD","DCA","BWI"],
  Rome: ["CIA","FCO"],
  Paris: ["ORY","BVA","CDG"]
};
