-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

create or replace table public.journey_details (
  type text null,
  uid text not null,
  scheduled text null,
  airline text null,
  flight_number text null,
  equipment text null,
  "from" text null,
  "to" text null,
  distance double precision null,
  tracking_status text null,
  cabin text null,
  payment_type text null,
  payment_amount_cash text null,
  payment_amount_points text null,
  leg_details text null,
  journey_details text null,
  country_entry text null,
  destination_coordinates text null,
  constraint journey_details_pkey primary key (uid)
) TABLESPACE pg_default;
