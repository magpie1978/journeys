/* global supabase */

const SUPABASE_URL = "https://jxmyetsjqkrluxqtevxy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bXlldHNqcWtybHV4cXRldnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMzI2NjYsImV4cCI6MjA4MDYwODY2Nn0.YoXEtsY_Zh1Eeuj0kl11AOaj01VrZzGGKoPhJyQP-iU";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

mapboxgl.accessToken ="pk.eyJ1IjoiY2hyaXMtZHVuaWdhbiIsImEiOiJjbWo4dDRtbGowM25lM2VzYWV0eHhocHp5In0.kO8gJyPmFLqQhz-kTTDyIQ";  /* Mapbox API token for rendering maps and vector tiles */

const MAX_ROUTES = 1000;

const AIRLINE_LOGO_BASE = "/flights/tailfins/";
/*const AIRLINE_LOGO_BASE = "https://raw.githubusercontent.com/magpie1978/douzepoints/main/tailfins/"; */

const airlineLogoMap = {
  "Ryanair": "Ryanair.webp",
  "British Airways": "BritishAirways.webp",
  "EasyJet": "easyJet.webp",
  "Wizz Air": "WizzAir.webp",
  "ITA Airways": "ITA.webp",
  "Aegean": "Aegean.webp",
  "Aer Lingus": "AerLingus.webp",
  "Air Asia": "AirAsia.webp",
  "Alaska Airways": "Alaska.webp",
  "American Airlines": "American.webp",
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
  "Lufthansa": "Lufthansa.webp",
  "Malaysia Airlines": "Malaysian.webp",
  "Norwegian": "Norwegian.webp",
  "Qantas": "Qantas.webp",
  "Qatar Airways": "QatarAirways.webp",
  "SAS": "SAS.webp",
  "Singapore Airlines": "SingaporeAirlines.webp",
  "Swiss": "Swiss.webp",
  "TUI": "TUI.webp",
  "Turkish Airlines": "TurkishAirlines.webp",
  "Virgin Atlantic": "VirginAtlantic.webp",
  "Virgin Australia": "VirginAustralia.webp",
  "Virgin Blue": "VirginAustralia.webp",
  "Volotea": "Volotea.webp",
  "WestJet": "WestJet.webp",
  "Vueling": "Vueling.webp"
};
