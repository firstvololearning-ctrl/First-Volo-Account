-- Runs only already-requested, expired deletions; never archives or creates requests.
create table private.student_deletion_attempts (
 request_id uuid primary key references public.student_deletion_requests(id) on delete cascade,
 attempts integer not null default 0,
 last_attempt_at timestamptz not null,
 outcome text not null check(outcome in ('completed','failed')),
 error_code text
);
alter table private.student_deletion_attempts enable row level security;
revoke all on private.student_deletion_attempts from public,anon,authenticated,service_role;
create function private.process_due_student_deletions()
returns jsonb language plpgsql security invoker set search_path='' set lock_timeout='2s' as $$
declare r record; done_count integer:=0; failed_count integer:=0; state text;
begin
 if not pg_try_advisory_xact_lock(74621,39017) then return jsonb_build_object('skipped','another run is active'); end if;
 for r in
  select d.id from public.student_deletion_requests d
  left join private.student_deletion_attempts a on a.request_id=d.id
  where d.status='pending' and d.delete_after<=clock_timestamp()
  order by a.last_attempt_at nulls first,d.delete_after,d.id limit 25
 loop
  begin
   perform private.finalize_student_deletion_request(r.id);
   insert into private.student_deletion_attempts(request_id,attempts,last_attempt_at,outcome,error_code)
   values(r.id,1,clock_timestamp(),'completed',null)
   on conflict(request_id) do update set attempts=private.student_deletion_attempts.attempts+1,
    last_attempt_at=excluded.last_attempt_at,outcome='completed',error_code=null;
   done_count:=done_count+1;
  exception when others then
   get stacked diagnostics state=returned_sqlstate;
   -- Log only SQLSTATE, never exception text that could contain learner data.
   insert into private.student_deletion_attempts(request_id,attempts,last_attempt_at,outcome,error_code)
   values(r.id,1,clock_timestamp(),'failed',state)
   on conflict(request_id) do update set attempts=private.student_deletion_attempts.attempts+1,
    last_attempt_at=excluded.last_attempt_at,outcome='failed',error_code=excluded.error_code;
   failed_count:=failed_count+1;
  end;
 end loop;
 return jsonb_build_object('completed',done_count,'failed',failed_count);
end $$;
revoke all on function private.process_due_student_deletions() from public,anon,authenticated,service_role;

create extension if not exists pg_cron;
select cron.schedule('first-volo-learner-deletion','*/5 * * * *','select private.process_due_student_deletions();');
