create or replace view public.journey_tracks_uid_dist as
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
      ) as prev_ts,
      lag(tr."position") over (
        partition by
          tr.callsign
        order by
          tr.utc
      ) as prev_position
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
      base.prev_position,
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
      segmented.prev_ts,
      segmented.prev_position,
      segmented.flight_no,
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
  ),
  with_distance as (
    select
      with_uid."timestamp",
      with_uid.utc,
      with_uid.callsign,
      with_uid.uid,
      with_uid."position",
      with_uid.altitude,
      with_uid.direction,
      with_uid.speed,
      case
        when with_uid.prev_position is null then null::double precision
        when with_uid.uid <> lag(with_uid.uid) over (
          partition by
            with_uid.callsign
          order by
            with_uid.utc
        ) then null::double precision
        else 3959::double precision * acos(
          LEAST(
            1.0::double precision,
            GREATEST(
              '-1.0'::numeric::double precision,
              sin(
                radians(
                  split_part(with_uid.prev_position, ','::text, 1)::double precision
                )
              ) * sin(
                radians(
                  split_part(with_uid."position", ','::text, 1)::double precision
                )
              ) + cos(
                radians(
                  split_part(with_uid.prev_position, ','::text, 1)::double precision
                )
              ) * cos(
                radians(
                  split_part(with_uid."position", ','::text, 1)::double precision
                )
              ) * cos(
                radians(
                  split_part(with_uid."position", ','::text, 2)::double precision - split_part(with_uid.prev_position, ','::text, 2)::double precision
                )
              )
            )
          )
        )
      end as distance
    from
      with_uid
  )
select
  "timestamp",
  utc,
  callsign,
  uid,
  "position",
  altitude,
  direction,
  speed,
  distance
from
  with_distance;
