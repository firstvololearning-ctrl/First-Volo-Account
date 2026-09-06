-- Operator-only completion step. Not a deletion request, timer, or public RPC.
-- Verify requester authority and any recovery period before calling.
create or replace function private.complete_student_deletion(
 p_owner_user_id uuid, p_student_id uuid, p_confirmation text
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
 if p_owner_user_id is null or p_student_id is null
    or p_confirmation is distinct from ('DELETE ' || p_student_id::text) then
   raise exception 'Explicit student deletion confirmation required' using errcode='22023';
 end if;
 perform 1 from public.students
  where id=p_student_id and owner_user_id=p_owner_user_id for update;
 if not found then
   raise exception 'Student and owner do not match an existing record' using errcode='22023';
 end if;
 -- Lock the parent before removing linked profiles, including soft-deleted ones.
 delete from public.learner_profiles
  where student_id=p_student_id and owner_user_id=p_owner_user_id;
 delete from public.students
  where id=p_student_id and owner_user_id=p_owner_user_id;
 if not found then raise exception 'Student deletion did not complete'; end if;
 return true;
end
$$;
revoke all on function private.complete_student_deletion(uuid,uuid,text)
 from public, anon, authenticated, service_role;
