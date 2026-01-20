-- ============================================
-- Materialized view: journeys_routes_cache
-- Source: journeys
-- Replaces: journeys_routes (runtime view)
-- Used by: stats.html, flights.html
-- Refresh: manual / scheduled
-- ============================================

create materialized view public.journeys_routes_cache as
select
  uid,
  callsign,
  airline,
  type as journey_type,
  origin,
  destination,
  destination_country,
  journey_distance,
  date (min("timestamp")) as journey_date,
  date_trunc('year'::text, min("timestamp"))::date as year,
  EXTRACT(
    epoch
    from
      max("timestamp") - min("timestamp")
  )::integer as journey_duration_seconds,
  st_asgeojson (
    st_simplifypreservetopology (
      st_makeline (
        st_setsrid (
          st_makepoint (
            split_part("position", ','::text, 2)::double precision,
            split_part("position", ','::text, 1)::double precision
          ),
          4326
        )
        order by
          "timestamp"
      ),
      0.002::double precision
    )
  )::json as geom
from
  journeys
group by
  uid,
  callsign,
  airline,
  type,
  origin,
  destination,
  destination_country,
  journey_distance;

CREATE INDEX journeys_routes_cache_uid_idx
  ON public.journeys_routes_cache (uid);

CREATE INDEX journeys_routes_cache_year_idx
  ON public.journeys_routes_cache (year);

CREATE INDEX journeys_routes_cache_airline_idx
  ON public.journeys_routes_cache (airline);

CREATE INDEX journeys_routes_cache_journey_type_idx
  ON public.journeys_routes_cache (journey_type);
