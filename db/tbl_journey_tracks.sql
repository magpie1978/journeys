create table public.journey_tracks (
  timestamp bigint null,
  utc timestamp with time zone null,
  callsign text null,
  position text null,
  altitude text null,
  speed text null,
  direction text null,
  id uuid not null default gen_random_uuid (),
  constraint journey_tracks_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists journey_tracks_utc_idx on public.journey_tracks using btree (utc) TABLESPACE pg_default;

create index IF not exists journey_tracks_callsign_idx on public.journey_tracks using btree (callsign) TABLESPACE pg_default;
