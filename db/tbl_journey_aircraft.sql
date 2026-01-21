-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-21
-- ============================================

CREATE public.journey_aircraft (
  icao text null, 
  iata text null, 
  model text null) 
TABLESPACE pg_default;
