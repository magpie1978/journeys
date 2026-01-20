create table public.journey_locations (
  category text null,
  airport_code text not null,
  airport text null,
  city text null,
  country text null,
  country_code text null,
  continent text null,
  longitude text null,
  latitude text null,
  constraint journey_locations_pkey primary key (airport_code)
) TABLESPACE pg_default;

create index IF not exists journey_locations_airport_code_idx on public.journey_locations using btree (airport_code) TABLESPACE pg_default;
