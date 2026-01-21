create table public.mv_refresh_state (
  name text not null,
  dirty boolean not null default false,
  last_refreshed timestamp with time zone null,
  constraint mv_refresh_state_pkey primary key (name)
) TABLESPACE pg_default;
