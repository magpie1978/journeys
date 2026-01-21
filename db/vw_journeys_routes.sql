-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

create view public.journeys_routes as
select
  c.uid,
  c.callsign,
  c.airline,
  c.journey_type,
  c.origin,
  c.destination,
  c.destination_country,
  c.journey_distance,
  c.journey_date,
  c.year,
  c.journey_duration_seconds,
  g.geom
from
  journeys_routes_core_mv c
  left join journeys_routes_geom_mv g using (uid);
