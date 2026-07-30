create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id text primary key,
  owner_id uuid not null references auth.users(id),
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  pace text not null check (pace in ('relaxed','normal','packed','unlimited')),
  must_quota_enabled boolean not null default false,
  must_quota_limit smallint not null default 3 check (must_quota_limit between 1 and 5),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'editor' check (role in ('owner','editor')),
  status text not null default 'active' check (status in ('active','removed')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create table if not exists public.trip_days (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  date date not null,
  position smallint not null,
  version integer not null default 1,
  unique (trip_id, position)
);

create table if not exists public.itinerary_items (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  day_id text not null references public.trip_days(id) on delete cascade,
  place_id text not null,
  title text not null,
  item_type text not null check (item_type in ('attraction','food','hotel','transport','shopping','rest')),
  start_time time not null,
  end_time time not null,
  stay_minutes integer not null check (stay_minutes > 0),
  note text,
  address text,
  google_place_id text,
  google_maps_url text,
  lat double precision,
  lng double precision,
  created_by uuid references auth.users(id) on delete set null,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.place_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  creator_name text not null,
  title text not null,
  address text,
  google_place_id text,
  google_maps_url text,
  lat double precision,
  lng double precision,
  suggested_type text not null default 'attraction' check (suggested_type in ('attraction','food','hotel','transport','shopping','rest')),
  status text not null default 'candidate' check (status in ('candidate','adopted','withdrawn')),
  adopted_item_id text references public.itinerary_items(id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists place_proposals_candidate_title_idx
  on public.place_proposals(trip_id, lower(title)) where status = 'candidate';

create table if not exists public.proposal_reactions (
  proposal_id uuid not null references public.place_proposals(id) on delete cascade,
  trip_id text not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('must','okay','no')),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, user_id)
);
create index if not exists proposal_reactions_trip_user_idx on public.proposal_reactions(trip_id, user_id, reaction);

create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_trip_member(target_trip_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from trip_members where trip_id = target_trip_id and user_id = auth.uid() and status = 'active') $$;

create or replace function public.is_trip_owner(target_trip_id text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from trips where id = target_trip_id and owner_id = auth.uid()) $$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.trip_invites enable row level security;
alter table public.place_proposals enable row level security;
alter table public.proposal_reactions enable row level security;
alter table public.activity_events enable row level security;

create policy "profiles read by signed in users" on public.profiles for select to authenticated using (true);
create policy "profiles update self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "trip owners create trips" on public.trips for insert to authenticated with check (owner_id = auth.uid());
create policy "members read trips" on public.trips for select to authenticated using (owner_id = auth.uid() or public.is_trip_member(id));
create policy "owners update trips" on public.trips for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete trips" on public.trips for delete to authenticated using (owner_id = auth.uid());
create policy "members read memberships" on public.trip_members for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));
create policy "owners manage memberships" on public.trip_members for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy "members read days" on public.trip_days for select to authenticated using (public.is_trip_member(trip_id) or public.is_trip_owner(trip_id));
create policy "owners manage days" on public.trip_days for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy "members read items" on public.itinerary_items for select to authenticated using (public.is_trip_member(trip_id));
create policy "members manage items" on public.itinerary_items for all to authenticated using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));
create policy "owners manage invites" on public.trip_invites for all to authenticated using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy "members read proposals" on public.place_proposals for select to authenticated using (public.is_trip_member(trip_id));
create policy "members create proposals" on public.place_proposals for insert to authenticated with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy "creators withdraw proposals" on public.place_proposals for update to authenticated using (created_by = auth.uid() and status = 'candidate');
create policy "members read reactions" on public.proposal_reactions for select to authenticated using (public.is_trip_member(trip_id));
create policy "members read activity" on public.activity_events for select to authenticated using (public.is_trip_member(trip_id));

create or replace function public.set_proposal_reaction(target_proposal_id uuid, target_reaction text)
returns void language plpgsql security definer set search_path = public as $$
declare target_trip text; quota_enabled boolean; quota_limit smallint; current_reaction text; used_count integer;
begin
  if target_reaction not in ('must','okay','no') then raise exception 'invalid_reaction'; end if;
  select trip_id into target_trip from place_proposals where id = target_proposal_id and status = 'candidate' for update;
  if target_trip is null or not is_trip_member(target_trip) then raise exception 'not_allowed'; end if;
  select must_quota_enabled, must_quota_limit into quota_enabled, quota_limit from trips where id = target_trip;
  select reaction into current_reaction from proposal_reactions where proposal_id = target_proposal_id and user_id = auth.uid();
  if quota_enabled and target_reaction = 'must' and current_reaction is distinct from 'must' then
    select count(*) into used_count from proposal_reactions where trip_id = target_trip and user_id = auth.uid() and reaction = 'must';
    if used_count >= quota_limit then raise exception 'must_quota_reached'; end if;
  end if;
  insert into proposal_reactions(proposal_id, trip_id, user_id, reaction)
    values(target_proposal_id, target_trip, auth.uid(), target_reaction)
    on conflict(proposal_id, user_id) do update set reaction = excluded.reaction, updated_at = now();
end $$;

create or replace function public.adopt_proposal(target_proposal_id uuid, target_day_id text, target_start time, target_end time, target_type text)
returns text language plpgsql security definer set search_path = public as $$
declare proposal place_proposals%rowtype; new_id text; overage_count integer;
begin
  select * into proposal from place_proposals where id = target_proposal_id and status = 'candidate' for update;
  if proposal.id is null or not is_trip_member(proposal.trip_id) then raise exception 'not_allowed'; end if;
  if not exists(select 1 from trip_days where id = target_day_id and trip_id = proposal.trip_id) then raise exception 'invalid_day'; end if;
  select count(*) into overage_count from (
    select r.user_id from proposal_reactions r join trip_members m on m.trip_id = r.trip_id and m.user_id = r.user_id and m.status = 'active'
    join trips t on t.id = r.trip_id where r.trip_id = proposal.trip_id and t.must_quota_enabled and r.reaction = 'must'
    group by r.user_id, t.must_quota_limit having count(*) > t.must_quota_limit
  ) overages;
  if overage_count > 0 then raise exception 'quota_adjustment_required'; end if;
  new_id := 'item-' || gen_random_uuid()::text;
  insert into itinerary_items(id, trip_id, day_id, place_id, title, item_type, start_time, end_time, stay_minutes, address, google_place_id, google_maps_url, lat, lng, created_by)
    values(new_id, proposal.trip_id, target_day_id, 'place-' || proposal.id::text, proposal.title, target_type, target_start, target_end,
      case when target_end > target_start then round(extract(epoch from (target_end - target_start)) / 60)::integer
        else round(extract(epoch from ((target_end + interval '24 hours') - target_start)) / 60)::integer end,
      proposal.address, proposal.google_place_id, proposal.google_maps_url, proposal.lat, proposal.lng, auth.uid());
  update place_proposals set status = 'adopted', adopted_item_id = new_id, version = version + 1, updated_at = now() where id = proposal.id;
  insert into activity_events(trip_id, actor_id, event_type, entity_id) values(proposal.trip_id, auth.uid(), 'proposal_adopted', proposal.id::text);
  return new_id;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, display_name, avatar_url) values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), '旅伴'), new.raw_user_meta_data->>'avatar_url') on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.log_itinerary_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare kind text;
begin
  kind := case
    when tg_op = 'INSERT' then 'item_created'
    when old.deleted_at is null and new.deleted_at is not null then 'item_deleted'
    when old.deleted_at is not null and new.deleted_at is null then 'item_restored'
    else 'item_updated'
  end;
  insert into activity_events(trip_id, actor_id, event_type, entity_id, payload)
    values(new.trip_id, auth.uid(), kind, new.id, jsonb_build_object('title', new.title, 'dayId', new.day_id));
  return new;
end $$;
drop trigger if exists itinerary_item_activity on public.itinerary_items;
create trigger itinerary_item_activity after insert or update on public.itinerary_items for each row execute procedure public.log_itinerary_activity();

create or replace function public.enforce_item_version() returns trigger language plpgsql as $$
begin
  if new.version <> old.version + 1 then raise exception 'version_conflict'; end if;
  return new;
end $$;
drop trigger if exists itinerary_item_version on public.itinerary_items;
create trigger itinerary_item_version before update on public.itinerary_items for each row execute procedure public.enforce_item_version();

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'place_proposals') then
    alter publication supabase_realtime add table public.place_proposals;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'proposal_reactions') then
    alter publication supabase_realtime add table public.proposal_reactions;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'itinerary_items') then
    alter publication supabase_realtime add table public.itinerary_items;
  end if;
end $$;

grant execute on function public.set_proposal_reaction(uuid, text) to authenticated;
grant execute on function public.adopt_proposal(uuid, text, time, time, text) to authenticated;
