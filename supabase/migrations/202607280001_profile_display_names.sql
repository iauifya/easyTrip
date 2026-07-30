alter table public.profiles
  add column if not exists display_name_confirmed boolean not null default false;

update public.profiles as profile
set display_name_confirmed = true
from auth.users as auth_user
where profile.id = auth_user.id
  and auth_user.raw_app_meta_data->>'provider' = 'google';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles(id, display_name, avatar_url, display_name_confirmed)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), '旅伴'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider' = 'google', false)
  )
  on conflict(id) do nothing;

  return new;
end
$$;

create or replace function public.set_my_display_name(
  target_display_name text,
  target_trip_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  normalized_name := btrim(regexp_replace(target_display_name, '[[:space:]]+', ' ', 'g'));

  if char_length(normalized_name) < 1 or char_length(normalized_name) > 30 then
    raise exception 'invalid_display_name';
  end if;

  insert into profiles(id, display_name, display_name_confirmed, updated_at)
  values(auth.uid(), normalized_name, true, now())
  on conflict(id) do update
  set
    display_name = excluded.display_name,
    display_name_confirmed = true,
    updated_at = now();

  if target_trip_id is not null then
    update trip_members
    set display_name = normalized_name
    where trip_id = target_trip_id
      and user_id = auth.uid()
      and status = 'active';

    if not found then
      raise exception 'not_allowed';
    end if;
  end if;
end
$$;

grant execute on function public.set_my_display_name(text, text) to authenticated;
