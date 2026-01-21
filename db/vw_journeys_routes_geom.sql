create materialized view public.journeys_routes_geom_mv as
select
  uid,
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
  uid;
