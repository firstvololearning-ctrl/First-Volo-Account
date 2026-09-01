-- REVIEW RECORD of live migration 20260901153521.
-- Fix the PL/pgSQL conflict-target ambiguity without changing authorization.

begin;

create or replace function public.set_class_product_access(
  p_class_id uuid,
  p_product_key text,
  p_enabled boolean
)
returns table (
  product_key text,
  enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid := auth.uid();
begin
  if v_owner_user_id is null
     or (select (auth.jwt()->>'is_anonymous')::boolean) is not false then
    raise exception using errcode = '28000', message = 'Educator access is required.';
  end if;

  if p_product_key is null or p_product_key not in (
    'first-volo-story-builder',
    'first-volo-morphology',
    'primo-volo'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported product.';
  end if;

  if p_enabled is null then
    raise exception using errcode = '22004', message = 'Enabled state is required.';
  end if;

  if not exists (
    select 1
    from public.classes as c
    where c.id = p_class_id
      and c.owner_user_id = v_owner_user_id
      and c.archived_at is null
  ) then
    raise exception using errcode = '42501', message = 'Class access could not be verified.';
  end if;

  if p_enabled then
    if not exists (
      select 1
      from public.product_entitlements as pe
      where pe.owner_user_id = v_owner_user_id
        and pe.product_key = p_product_key
        and pe.status = 'active'
        and pe.starts_at <= now()
        and pe.expires_at > now()
    ) then
      raise exception using errcode = '42501', message = 'Active educator product access is required.';
    end if;

    insert into public.class_product_access (class_id, owner_user_id, product_key)
    values (p_class_id, v_owner_user_id, p_product_key)
    on conflict on constraint class_product_access_pkey do nothing;
  else
    delete from public.class_product_access as cpa
    where cpa.class_id = p_class_id
      and cpa.owner_user_id = v_owner_user_id
      and cpa.product_key = p_product_key;
  end if;

  return query
  select p_product_key, p_enabled;
end;
$$;

commit;
