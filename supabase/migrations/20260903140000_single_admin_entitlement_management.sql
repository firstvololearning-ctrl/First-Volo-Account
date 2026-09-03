-- Single-admin entitlement management for My First Volo.
-- Runtime authorization is tied to auth.users.id. Email is used only once to seed
-- the initial administrator membership.

create schema if not exists private;

create table if not exists private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'entitlement_admin'
    check (role = 'entitlement_admin'),
  created_at timestamptz not null default now()
);

create table if not exists private.entitlement_admin_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  target_user_id uuid not null references auth.users(id),
  product_key text not null,
  action text not null check (action in ('grant', 'replace', 'deactivate')),
  previous_state jsonb not null default '[]'::jsonb,
  resulting_state jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table private.admin_memberships enable row level security;
alter table private.entitlement_admin_audit enable row level security;
revoke all on table private.admin_memberships from public, anon, authenticated;
revoke all on table private.entitlement_admin_audit from public, anon, authenticated;

do $seed$
declare
  v_user_id uuid;
  v_match_count integer;
begin
  select count(*), (array_agg(id))[1]
  into v_match_count, v_user_id
  from auth.users
  where lower(email) = lower('firstvololearning@gmail.com')
    and coalesce(is_anonymous, false) = false
    and email_confirmed_at is not null;

  if v_match_count <> 1 then
    raise exception 'Initial administrator account could not be uniquely verified.';
  end if;

  insert into private.admin_memberships (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;
end
$seed$;

create or replace function private.is_entitlement_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.admin_memberships am
    join auth.users au on au.id = am.user_id
    where am.user_id = p_user_id
      and am.role = 'entitlement_admin'
      and coalesce(au.is_anonymous, false) = false
  );
$function$;

revoke execute on function private.is_entitlement_admin(uuid) from public, anon, authenticated;

create or replace function public.get_entitlement_admin_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(private.is_entitlement_admin(auth.uid()), false);
$function$;

create or replace function public.find_educator_entitlements(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_target auth.users%rowtype;
begin
  if not private.is_entitlement_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  select * into v_target
  from auth.users
  where lower(email) = lower(trim(p_email))
    and coalesce(is_anonymous, false) = false
  limit 1;

  if v_target.id is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object(
    'found', true,
    'user_id', v_target.id,
    'email', v_target.email,
    'display_name', (select ep.display_name from public.educator_profiles ep where ep.user_id = v_target.id),
    'entitlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id,
        'product_key', pe.product_key,
        'access_type', pe.access_type,
        'status', pe.status,
        'starts_at', pe.starts_at,
        'expires_at', pe.expires_at
      ) order by pe.product_key, pe.created_at desc)
      from public.product_entitlements pe
      where pe.owner_user_id = v_target.id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.set_educator_complimentary_access(
  p_target_user_id uuid,
  p_product_key text,
  p_expires_at timestamptz,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_previous jsonb;
  v_result jsonb;
  v_action text;
begin
  if not private.is_entitlement_admin(v_actor) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;
  if p_product_key not in ('first-volo-story-builder', 'first-volo-morphology', 'primo-volo') then
    raise exception using errcode = '22023', message = 'Unsupported product.';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22004', message = 'Enabled state is required.';
  end if;
  if not exists (
    select 1 from auth.users au
    where au.id = p_target_user_id and coalesce(au.is_anonymous, false) = false
  ) then
    raise exception using errcode = '22023', message = 'Educator account was not found.';
  end if;
  if p_enabled and (p_expires_at is null or p_expires_at <= now()) then
    raise exception using errcode = '22023', message = 'A future expiration date is required.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(pe) order by pe.created_at), '[]'::jsonb)
  into v_previous
  from public.product_entitlements pe
  where pe.owner_user_id = p_target_user_id and pe.product_key = p_product_key;

  update public.product_entitlements
  set status = 'revoked', updated_at = now()
  where owner_user_id = p_target_user_id
    and product_key = p_product_key
    and status = 'active';

  if p_enabled then
    insert into public.product_entitlements (
      owner_user_id, product_key, access_type, status, starts_at, expires_at
    ) values (
      p_target_user_id, p_product_key, 'complimentary_annual', 'active', now(), p_expires_at
    );
    v_action := case when jsonb_array_length(v_previous) = 0 then 'grant' else 'replace' end;
  else
    v_action := 'deactivate';
  end if;

  select coalesce(jsonb_agg(to_jsonb(pe) order by pe.created_at), '[]'::jsonb)
  into v_result
  from public.product_entitlements pe
  where pe.owner_user_id = p_target_user_id and pe.product_key = p_product_key;

  insert into private.entitlement_admin_audit (
    actor_user_id, target_user_id, product_key, action, previous_state, resulting_state
  ) values (v_actor, p_target_user_id, p_product_key, v_action, v_previous, v_result);

  return jsonb_build_object('ok', true, 'action', v_action, 'entitlements', v_result);
end;
$function$;

revoke execute on function public.get_entitlement_admin_status() from public, anon;
revoke execute on function public.find_educator_entitlements(text) from public, anon;
revoke execute on function public.set_educator_complimentary_access(uuid, text, timestamptz, boolean) from public, anon;
grant execute on function public.get_entitlement_admin_status() to authenticated;
grant execute on function public.find_educator_entitlements(text) to authenticated;
grant execute on function public.set_educator_complimentary_access(uuid, text, timestamptz, boolean) to authenticated;
