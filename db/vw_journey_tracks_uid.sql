create or replace view public.journey_tracks_uid as
with
  base as (
    select
      tr."timestamp",
      tr.utc,
      tr.callsign,
      tr."position",
      tr.altitude,
      tr.speed,
      tr.direction,
      lag(tr.utc) over (
        partition by
          tr.callsign
        order by
          tr.utc
      ) as prev_ts
    from
      journey_tracks tr
  ),
  segmented as (
    select
      base."timestamp",
      base.utc,
      base.callsign,
      base."position",
      base.altitude,
      base.speed,
      base.direction,
      base.prev_ts,
      sum(
        case
          when base.prev_ts is null then 1
          when (base.utc - base.prev_ts) > '06:00:00'::interval then 1
          else 0
        end
      ) over (
        partition by
          base.callsign
        order by
          base.utc
      ) as flight_no
    from
      base
  ),
  with_uid as (
    select
      segmented."timestamp",
      segmented.utc,
      segmented.callsign,
      segmented."position",
      segmented.altitude,
      segmented.speed,
      segmented.direction,
      (segmented.callsign || '-'::text) || "left" (
        first_value(segmented.utc) over (
          partition by
            segmented.callsign,
            segmented.flight_no
          order by
            segmented.utc
        )::text,
        10
      ) as uid
    from
      segmented
  )
select
  "timestamp",
  utc,
  callsign,
  uid,
  "position",
  altitude,
  direction,
  speed
from
  with_uid;
