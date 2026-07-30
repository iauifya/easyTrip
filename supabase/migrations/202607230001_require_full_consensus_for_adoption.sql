create or replace function public.adopt_proposal(
  target_proposal_id uuid,
  target_day_id text,
  target_start time,
  target_end time,
  target_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal place_proposals%rowtype;
  new_id text;
  overage_count bigint;
  active_member_count bigint;
  reaction_count bigint;
  no_count bigint;
begin
  select *
  into proposal
  from place_proposals
  where id = target_proposal_id
    and status = 'candidate'
  for update;

  if proposal.id is null or not is_trip_member(proposal.trip_id) then
    raise exception 'not_allowed';
  end if;

  if not exists(
    select 1
    from trip_days
    where id = target_day_id
      and trip_id = proposal.trip_id
  ) then
    raise exception 'invalid_day';
  end if;

  select count(*)
  into overage_count
  from (
    select r.user_id
    from proposal_reactions r
    join trip_members m
      on m.trip_id = r.trip_id
      and m.user_id = r.user_id
      and m.status = 'active'
    join trips t on t.id = r.trip_id
    where r.trip_id = proposal.trip_id
      and t.must_quota_enabled
      and r.reaction = 'must'
    group by r.user_id, t.must_quota_limit
    having count(*) > t.must_quota_limit
  ) overages;

  if overage_count > 0 then
    raise exception 'quota_adjustment_required';
  end if;

  select count(*)
  into active_member_count
  from trip_members
  where trip_id = proposal.trip_id
    and status = 'active';

  select
    count(*),
    count(*) filter (where r.reaction = 'no')
  into reaction_count, no_count
  from proposal_reactions r
  join trip_members m
    on m.trip_id = r.trip_id
    and m.user_id = r.user_id
    and m.status = 'active'
  where r.proposal_id = proposal.id;

  if reaction_count < active_member_count then
    raise exception 'consensus_incomplete';
  end if;

  if no_count > 0 then
    raise exception 'consensus_blocked';
  end if;

  new_id := 'item-' || gen_random_uuid()::text;

  insert into itinerary_items(
    id,
    trip_id,
    day_id,
    place_id,
    title,
    item_type,
    start_time,
    end_time,
    stay_minutes,
    address,
    google_place_id,
    google_maps_url,
    lat,
    lng,
    created_by
  )
  values(
    new_id,
    proposal.trip_id,
    target_day_id,
    'place-' || proposal.id::text,
    proposal.title,
    target_type,
    target_start,
    target_end,
    case
      when target_end > target_start
        then round(extract(epoch from (target_end - target_start)) / 60)::integer
      else round(extract(epoch from ((target_end + interval '24 hours') - target_start)) / 60)::integer
    end,
    proposal.address,
    proposal.google_place_id,
    proposal.google_maps_url,
    proposal.lat,
    proposal.lng,
    auth.uid()
  );

  update place_proposals
  set
    status = 'adopted',
    adopted_item_id = new_id,
    version = version + 1,
    updated_at = now()
  where id = proposal.id;

  insert into activity_events(trip_id, actor_id, event_type, entity_id)
  values(proposal.trip_id, auth.uid(), 'proposal_adopted', proposal.id::text);

  return new_id;
end
$$;

grant execute on function public.adopt_proposal(uuid, text, time, time, text) to authenticated;
