create or replace view public.journeys as
with
  base as (
    select
      tr_1."timestamp" as utc,
      tr_1.utc as "timestamp",
      tr_1.callsign,
      tr_1."position",
      tr_1.altitude,
      tr_1.speed,
      tr_1.direction,
      split_part(tr_1."position", ','::text, 1)::double precision as lat_curr,
      split_part(tr_1."position", ','::text, 2)::double precision as lon_curr,
      lag(tr_1.utc) over (
        partition by
          tr_1.callsign
        order by
          tr_1.utc
      ) as prev_ts
    from
      journey_tracks tr_1
  ),
  segmented as (
    select
      base.utc,
      base."timestamp",
      base.callsign,
      base."position",
      base.altitude,
      base.speed,
      base.direction,
      base.lat_curr,
      base.lon_curr,
      base.prev_ts,
      sum(
        case
          when base.prev_ts is null then 1
          when (base."timestamp" - base.prev_ts) > '06:00:00'::interval then 1
          else 0
        end
      ) over (
        partition by
          base.callsign
        order by
          base."timestamp"
      ) as flight_no
    from
      base
  ),
  with_uid as (
    select
      segmented.utc,
      segmented."timestamp",
      segmented.callsign,
      segmented."position",
      segmented.altitude,
      segmented.speed,
      segmented.direction,
      segmented.lat_curr,
      segmented.lon_curr,
      segmented.prev_ts,
      segmented.flight_no,
      (segmented.callsign || '-'::text) || "left" (
        first_value(segmented."timestamp") over (
          partition by
            segmented.callsign,
            segmented.flight_no
          order by
            segmented."timestamp"
        )::text,
        10
      ) as uid
    from
      segmented
  ),
  lagged as (
    select
      with_uid.utc,
      with_uid."timestamp",
      with_uid.callsign,
      with_uid."position",
      with_uid.altitude,
      with_uid.speed,
      with_uid.direction,
      with_uid.lat_curr,
      with_uid.lon_curr,
      with_uid.prev_ts,
      with_uid.flight_no,
      with_uid.uid,
      lag(with_uid.uid) over w2 as uid_prev,
      lag(with_uid.lat_curr) over w2 as lat_prev,
      lag(with_uid.lon_curr) over w2 as lon_prev
    from
      with_uid
    window
      w2 as (
        partition by
          with_uid.uid
        order by
          with_uid."timestamp"
      )
  )
select
  tr.utc,
  tr."timestamp",
  tr.callsign,
  tr.uid,
  tr."position",
  tr.altitude,
  tr.direction,
  case
    when tr.uid <> tr.uid_prev then null::double precision
    when tr.lat_prev is null then null::double precision
    else 3959::double precision * acos(
      sin(radians(tr.lat_prev)) * sin(radians(tr.lat_curr)) + cos(radians(tr.lat_prev)) * cos(radians(tr.lat_curr)) * cos(radians(tr.lon_curr) - radians(tr.lon_prev))
    )
  end as segment_distance,
  det.type,
  det.scheduled,
  det.airline,
  det.flight_number,
  det.equipment,
  det."from" as origin,
  det."to" as destination,
  det.distance as journey_distance,
  det.tracking_status,
  det.cabin,
  det.payment_type,
  det.payment_amount_cash,
  det.payment_amount_points,
  det.leg_details,
  det.journey_details,
  det.country_entry,
  det.destination_coordinates,
  o.airport_code as origin_code,
  o.airport as origin_name,
  o.city as origin_city,
  o.country as origin_country,
  d.airport_code as destination_code,
  d.airport as destination_name,
  d.city as destination_city,
  d.country as destination_country
from
  lagged tr
  left join journey_details det on tr.uid = det.uid
  left join journey_locations o on o.airport_code = det."from"
  left join journey_destinations d on d.airport_code = det."to";
