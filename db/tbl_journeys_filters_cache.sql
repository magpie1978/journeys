-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

create or replace table public.journeys_filters_cache (year date null, airline text null) TABLESPACE pg_default;
