-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

CREATE OR REPLACE TABLE public.journey_destinations (
  category text null,
  airport_code text not null,
  airport text null,
  city text null,
  country text null,
  country_code text null,
  continent text null,
  longitude text null,
  latitude text null,
  constraint journey_destinations_pkey primary key (airport_code)
) TABLESPACE pg_default;

create index IF not exists journey_destinations_airport_code_idx on public.journey_destinations using btree (airport_code) TABLESPACE pg_default;
