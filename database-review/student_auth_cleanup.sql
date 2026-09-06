create or replace function private.cleanup_deleted_student_auth()
returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid;
begin
 for account_id in
  select l.auth_user_id from public.student_auth_links l
  where l.student_id=old.id and l.owner_user_id=old.owner_user_id
  order by l.auth_user_id for update
 loop
  perform 1 from auth.users u where u.id=account_id and u.is_anonymous is true
   and nullif(u.email,'') is null and nullif(u.phone,'') is null for update;
  if not found then continue; end if;
  -- Preserve upgraded accounts and any account with a separate ownership role.
  if exists(select 1 from auth.identities where user_id=account_id)
   or exists(select 1 from public.educator_profiles where user_id=account_id)
   or exists(select 1 from public.students where owner_user_id=account_id)
   or exists(select 1 from public.classes where owner_user_id=account_id)
   or exists(select 1 from public.learner_profiles where owner_user_id=account_id)
   or exists(select 1 from public.product_entitlements where owner_user_id=account_id)
   or exists(select 1 from public.story_builder_stories where user_id=account_id)
   or exists(select 1 from private.admin_memberships where user_id=account_id)
   or exists(select 1 from public.student_auth_links where auth_user_id=account_id
       and (student_id<>old.id or owner_user_id<>old.owner_user_id))
  then continue; end if;
  -- Explicit refresh-token removal covers tokens without a session reference.
  delete from auth.refresh_tokens where user_id=account_id::text;
  delete from auth.sessions where user_id=account_id;
  delete from auth.users where id=account_id and is_anonymous is true;
 end loop;
 return old;
end $$;
revoke all on function private.cleanup_deleted_student_auth() from public,anon,authenticated;
create trigger cleanup_deleted_student_auth before delete on public.students
for each row execute function private.cleanup_deleted_student_auth();
