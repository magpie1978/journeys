-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

create materialized view public.journeys_routes_core_mv as
select
  uid,
  callsign,
  airline,
  type as journey_type,
  origin,
  destination,
  destination_country,
  sum(segment_distance) as journey_distance,
  date (min("timestamp")) as journey_date,
  date_trunc('year'::text, min("timestamp"))::date as year,
  EXTRACT(
    epoch
    from
      max("timestamp") - min("timestamp")
  )::integer as journey_duration_seconds
from
  journeys
group by
  uid,
  callsign,
  airline,
  type,
  origin,
  destination,
  destination_country;
