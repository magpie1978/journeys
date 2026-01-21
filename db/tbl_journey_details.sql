-- ============================================
-- View: journeys_routes_cache
-- Depends on: journeys_routes
-- Used by: stats.html, flights.html
-- Last updated: 2026-01-15
-- ============================================

create table public.journey_details (
  type text null,
  uid text null,
  scheduled text null,
  airline text null,
  flight_number text null,
  equipment text null,
  "from" text null,
  "to" text null,
  tracking_status text null,
  cabin text null,
  payment_type text null,
  payment_amount_cash text null,
  payment_amount_points text null,
  leg_details text null,
  journey_details text null
) TABLESPACE pg_default;

create trigger journey_details_dirty_after_change
after INSERT
or DELETE
or
update on journey_details for EACH STATEMENT
execute FUNCTION mark_routes_mv_dirty ();
