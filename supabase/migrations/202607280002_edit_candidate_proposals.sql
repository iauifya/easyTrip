drop policy if exists "creators withdraw proposals" on public.place_proposals;

create policy "creators update candidate proposals"
on public.place_proposals
for update
to authenticated
using (
  created_by = auth.uid()
  and status = 'candidate'
  and public.is_trip_member(trip_id)
)
with check (
  created_by = auth.uid()
  and status in ('candidate', 'withdrawn')
  and public.is_trip_member(trip_id)
);

create or replace function public.update_proposal_details(
  target_proposal_id uuid,
  target_title text,
  target_address text,
  target_type text,
  expected_version integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_title text;
  normalized_address text;
begin
  normalized_title := btrim(regexp_replace(target_title, '[[:space:]]+', ' ', 'g'));
  normalized_address := nullif(btrim(regexp_replace(coalesce(target_address, ''), '[[:space:]]+', ' ', 'g')), '');

  if char_length(normalized_title) < 2 or char_length(normalized_title) > 100 then
    raise exception 'invalid_proposal_title';
  end if;

  if normalized_address is not null and char_length(normalized_address) > 300 then
    raise exception 'invalid_proposal_address';
  end if;

  update place_proposals
  set
    title = normalized_title,
    address = normalized_address,
    suggested_type = target_type,
    version = version + 1,
    updated_at = now()
  where id = target_proposal_id
    and created_by = auth.uid()
    and status = 'candidate'
    and version = expected_version
    and public.is_trip_member(trip_id);

  if not found then
    if exists(
      select 1
      from place_proposals
      where id = target_proposal_id
        and created_by = auth.uid()
        and status = 'candidate'
        and public.is_trip_member(trip_id)
    ) then
      raise exception 'version_conflict';
    end if;

    raise exception 'not_allowed';
  end if;
end
$$;

grant execute on function public.update_proposal_details(uuid, text, text, text, integer) to authenticated;
