-- REVIEW ARTIFACT ONLY. Do not apply until the current live definitions and
-- constraints have been compared with this migration in the Supabase SQL editor.
-- Phase 2: bind anonymous student sessions to the login class and authorize
-- student-mode product availability through class assignment + educator entitlement.

begin;

alter table public.student_auth_links
  add column class_id uuid;

-- Existing active links did not record a class. Preserve links only when there
-- is exactly one active class membership that can be inferred without guessing.
with unambiguous_links as (
  select sal.auth_user_id, min(cm.class_id::text)::uuid as class_id
  from public.student_auth_links as sal
  join public.students as s
    on s.id = sal.student_id
   and s.owner_user_id = sal.owner_user_id
   and s.archived_at is null
  join public.class_memberships as cm
    on cm.student_id = sal.student_id
   and cm.owner_user_id = sal.owner_user_id
  join public.classes as c
    on c.id = cm.class_id
   and c.owner_user_id = sal.owner_user_id
   and c.archived_at is null
  where sal.class_id is null
    and sal.revoked_at is null
  group by sal.auth_user_id
  having count(*) = 1
)
update public.student_auth_links as sal
set class_id = inferred.class_id
from unambiguous_links as inferred
where sal.auth_user_id = inferred.auth_user_id;

-- Ambiguous or orphaned legacy links fail closed. Their anonymous Auth users
-- may sign in again with valid Class Code + Student Code credentials.
update public.student_auth_links
set revoked_at = coalesce(revoked_at, now())
where class_id is null
  and revoked_at is null;

alter table public.student_auth_links
  add constraint student_auth_links_class_owner_fkey
  foreign key (class_id, owner_user_id)
  references public.classes (id, owner_user_id)
  on delete cascade;

create index student_auth_links_class_owner_idx
  on public.student_auth_links (class_id, owner_user_id);

alter table public.student_auth_links
  add constraint student_auth_links_active_class_check
  check (revoked_at is not null or class_id is not null);

create or replace function public.claim_student_login(
  p_class_code text,
  p_student_code text
)
returns table (
  student_id uuid,
  display_name text,
  class_id uuid,
  class_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_student_id uuid;
  v_display_name text;
  v_class_id uuid;
  v_class_name text;
  v_owner_user_id uuid;
  v_class_code text := regexp_replace(
    upper(coalesce(p_class_code, '')),
    '[^A-Z0-9]',
    '',
    'g'
  );
  v_student_code text := regexp_replace(
    upper(coalesce(p_student_code, '')),
    '[^A-Z0-9]',
    '',
    'g'
  );
begin
  if v_auth_user_id is null
     or (select (auth.jwt()->>'is_anonymous')::boolean) is not true then
    raise exception using errcode = '28000', message = 'Class code or student code could not be verified.';
  end if;

  if char_length(v_class_code) not between 5 and 12
     or char_length(v_student_code) <> 12 then
    raise exception using errcode = '28000', message = 'Class code or student code could not be verified.';
  end if;

  begin
    select s.id, s.display_name, c.id, c.name, c.owner_user_id
      into strict v_student_id, v_display_name, v_class_id, v_class_name, v_owner_user_id
    from public.classes as c
    join public.class_memberships as cm
      on cm.class_id = c.id
     and cm.owner_user_id = c.owner_user_id
    join public.students as s
      on s.id = cm.student_id
     and s.owner_user_id = c.owner_user_id
    where c.archived_at is null
      and s.archived_at is null
      and c.class_code = v_class_code
      and s.student_code_hash is not null
      and s.student_code_hash = encode(extensions.digest(v_student_code, 'sha256'), 'hex');
  exception
    when no_data_found or too_many_rows then
      raise exception using errcode = '28000', message = 'Class code or student code could not be verified.';
  end;

  insert into public.student_auth_links (
    auth_user_id,
    student_id,
    class_id,
    owner_user_id,
    last_verified_at,
    revoked_at
  )
  values (
    v_auth_user_id,
    v_student_id,
    v_class_id,
    v_owner_user_id,
    now(),
    null
  )
  on conflict (auth_user_id) do update
    set student_id = excluded.student_id,
        class_id = excluded.class_id,
        owner_user_id = excluded.owner_user_id,
        last_verified_at = excluded.last_verified_at,
        revoked_at = null;

  return query
  select v_student_id, v_display_name, v_class_id, v_class_name;
end;
$$;

create or replace function public.get_student_session_context()
returns table (
  student_id uuid,
  display_name text,
  class_id uuid,
  class_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_student_id uuid;
  v_display_name text;
  v_class_id uuid;
  v_class_name text;
begin
  if v_auth_user_id is null
     or (select (auth.jwt()->>'is_anonymous')::boolean) is not true then
    return;
  end if;

  select s.id, s.display_name, c.id, c.name
    into v_student_id, v_display_name, v_class_id, v_class_name
  from public.student_auth_links as sal
  join public.students as s
    on s.id = sal.student_id
   and s.owner_user_id = sal.owner_user_id
   and s.archived_at is null
  join public.classes as c
    on c.id = sal.class_id
   and c.owner_user_id = sal.owner_user_id
   and c.archived_at is null
  join public.class_memberships as cm
    on cm.class_id = sal.class_id
   and cm.student_id = sal.student_id
   and cm.owner_user_id = sal.owner_user_id
  where sal.auth_user_id = v_auth_user_id
    and sal.revoked_at is null;

  if not found then
    return;
  end if;

  update public.student_auth_links
  set last_verified_at = now()
  where auth_user_id = v_auth_user_id
    and revoked_at is null;

  return query
  select v_student_id, v_display_name, v_class_id, v_class_name;
end;
$$;

create table public.class_product_access (
  class_id uuid not null,
  owner_user_id uuid not null,
  product_key text not null,
  created_at timestamptz not null default now(),
  constraint class_product_access_pkey primary key (class_id, product_key),
  constraint class_product_access_class_owner_fkey
    foreign key (class_id, owner_user_id)
    references public.classes (id, owner_user_id)
    on delete cascade,
  constraint class_product_access_product_key_check
    check (product_key in (
      'first-volo-story-builder',
      'first-volo-morphology',
      'primo-volo'
    ))
);

create index class_product_access_owner_class_idx
  on public.class_product_access (owner_user_id, class_id);

alter table public.class_product_access enable row level security;

-- Anonymous Auth users also carry the authenticated Postgres role. This policy
-- therefore requires both ownership and a permanent (non-anonymous) session.
create policy class_product_access_educator_select
on public.class_product_access
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and (select (auth.jwt()->>'is_anonymous')::boolean) is false
);

revoke all on table public.class_product_access from public, anon, authenticated;
grant select on table public.class_product_access to authenticated;

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
    on conflict (class_id, product_key) do nothing;
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

create or replace function public.get_student_product_access()
returns table (product_key text)
language sql
security definer
set search_path = ''
stable
as $$
  select distinct cpa.product_key
  from public.student_auth_links as sal
  join public.students as s
    on s.id = sal.student_id
   and s.owner_user_id = sal.owner_user_id
   and s.archived_at is null
  join public.classes as c
    on c.id = sal.class_id
   and c.owner_user_id = sal.owner_user_id
   and c.archived_at is null
  join public.class_memberships as cm
    on cm.class_id = sal.class_id
   and cm.student_id = sal.student_id
   and cm.owner_user_id = sal.owner_user_id
  join public.class_product_access as cpa
    on cpa.class_id = sal.class_id
   and cpa.owner_user_id = sal.owner_user_id
  join public.product_entitlements as pe
    on pe.owner_user_id = sal.owner_user_id
   and pe.product_key = cpa.product_key
   and pe.status = 'active'
   and pe.starts_at <= now()
   and pe.expires_at > now()
  where sal.auth_user_id = auth.uid()
    and sal.revoked_at is null
    and (select (auth.jwt()->>'is_anonymous')::boolean) is true
  order by cpa.product_key;
$$;

revoke execute on function public.claim_student_login(text, text) from public, anon;
revoke execute on function public.get_student_session_context() from public, anon;
revoke execute on function public.set_class_product_access(uuid, text, boolean) from public, anon;
revoke execute on function public.get_student_product_access() from public, anon;

grant execute on function public.claim_student_login(text, text) to authenticated;
grant execute on function public.get_student_session_context() to authenticated;
grant execute on function public.set_class_product_access(uuid, text, boolean) to authenticated;
grant execute on function public.get_student_product_access() to authenticated;

commit;
