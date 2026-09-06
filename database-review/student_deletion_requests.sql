-- Request history stores identifiers, never names or work. No student FK: preserve completion status.
create table public.student_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null,
 requested_at timestamptz not null default now(),
 delete_after timestamptz not null default (now()+interval '30 days'),
 previous_archived_at timestamptz,
 status text not null default 'pending' check(status in ('pending','cancelled','completed')),
 resolved_at timestamptz,
 check(delete_after >= requested_at+interval '30 days'),
 check((status='pending')=(resolved_at is null))
);
create unique index student_deletion_one_pending on public.student_deletion_requests(student_id) where status='pending';
create index student_deletion_owner on public.student_deletion_requests(owner_user_id,requested_at);
alter table public.student_deletion_requests enable row level security;
revoke all on public.student_deletion_requests from public,anon,authenticated;
grant select on public.student_deletion_requests to authenticated;
create policy deletion_owner_read on public.student_deletion_requests for select to authenticated
 using(owner_user_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));

create function public.request_student_deletion(p_student_id uuid,p_confirmation text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r uuid; old_archive timestamptz;
begin
 if u is null or not exists(select 1 from auth.users where id=u and is_anonymous=false and email_confirmed_at is not null)
 or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Educator sign-in required' using errcode='42501'; end if;
 if p_confirmation is distinct from 'DELETE' then raise exception 'Type DELETE to confirm' using errcode='22023'; end if;
 select archived_at into old_archive from public.students where id=p_student_id and owner_user_id=u for update;
 if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
 select id into r from public.student_deletion_requests where student_id=p_student_id and owner_user_id=u and status='pending' for update;
 if r is not null then return r; end if;
 insert into public.student_deletion_requests(owner_user_id,student_id,previous_archived_at)
 values(u,p_student_id,old_archive) returning id into r;
 update public.students set archived_at=coalesce(archived_at,now()) where id=p_student_id and owner_user_id=u;
 update public.student_auth_links set revoked_at=now() where student_id=p_student_id and owner_user_id=u and revoked_at is null;
 return r;
end $$;
revoke all on function public.request_student_deletion(uuid,text) from public,anon;
grant execute on function public.request_student_deletion(uuid,text) to authenticated;

create function public.cancel_student_deletion(p_request_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid; r public.student_deletion_requests%rowtype;
begin
 if u is null or not exists(select 1 from auth.users where id=u and is_anonymous=false and email_confirmed_at is not null)
 or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Educator sign-in required' using errcode='42501'; end if;
 select student_id into sid from public.student_deletion_requests where id=p_request_id and owner_user_id=u;
 if sid is null then raise exception 'Request unavailable' using errcode='42501'; end if;
 perform 1 from public.students where id=sid and owner_user_id=u for update;
 if not found then raise exception 'Student unavailable' using errcode='42501'; end if;
 select * into r from public.student_deletion_requests where id=p_request_id and owner_user_id=u for update;
 if r.status='cancelled' then return true; end if;
 if r.status<>'pending' or clock_timestamp()>=r.delete_after then raise exception 'Recovery period has ended' using errcode='22023'; end if;
 update public.students set archived_at=r.previous_archived_at where id=sid and owner_user_id=u;
 update public.student_deletion_requests set status='cancelled',resolved_at=now() where id=r.id;
 -- Revoked sessions remain revoked: student can sign in again if otherwise eligible.
 return true;
end $$;
revoke all on function public.cancel_student_deletion(uuid) from public,anon;
grant execute on function public.cancel_student_deletion(uuid) to authenticated;

create function private.finalize_student_deletion_request(p_request_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare r public.student_deletion_requests%rowtype;
begin
 select * into r from public.student_deletion_requests where id=p_request_id;
 if not found then raise exception 'Request unavailable' using errcode='22023'; end if;
 if r.status='completed' then return true; end if;
 perform 1 from public.students where id=r.student_id and owner_user_id=r.owner_user_id for update;
 if not found then raise exception 'Student unavailable' using errcode='22023'; end if;
 select * into r from public.student_deletion_requests where id=p_request_id for update;
 if r.status='completed' then return true; end if;
 if r.status<>'pending' or clock_timestamp()<r.delete_after then raise exception 'Request is not due for deletion' using errcode='22023'; end if;
 perform private.complete_student_deletion(r.owner_user_id,r.student_id,'DELETE '||r.student_id::text);
 update public.student_deletion_requests set status='completed',resolved_at=now() where id=r.id;
 return true;
end $$;
revoke all on function private.finalize_student_deletion_request(uuid) from public,anon,authenticated,service_role;
