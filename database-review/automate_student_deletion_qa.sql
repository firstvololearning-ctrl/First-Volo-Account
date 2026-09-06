create temporary table automated_qa_result(test text, passed boolean) on commit drop;
create temporary table automated_qa_block(student_id uuid) on commit drop;
create function pg_temp.automated_qa_block() returns trigger language plpgsql as $$ begin
 if exists(select 1 from pg_temp.automated_qa_block where student_id=old.id) then raise exception 'Fictional learner detail must not be logged' using errcode='23503'; end if; return old;
end $$;
create trigger automated_qa_block before delete on public.students for each row execute function pg_temp.automated_qa_block();
do $$
declare o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); ra uuid; rb uuid; rc uuid; rd uuid; result jsonb;
begin
 if exists(select 1 from public.student_deletion_requests where status='pending' and delete_after<=now()) then raise exception 'QA requires no existing due requests'; end if;
 insert into auth.users(id,is_anonymous,email_confirmed_at) values(o,false,now());
 insert into public.students(id,owner_user_id,display_name) values(a,o,'Fictional due'),(b,o,'Fictional retry'),(c,o,'Fictional early'),(d,o,'Fictional cancelled');
 perform set_config('request.jwt.claims',json_build_object('sub',o,'is_anonymous',false)::text,true);
 ra:=public.request_student_deletion(a,'DELETE');rb:=public.request_student_deletion(b,'DELETE');rc:=public.request_student_deletion(c,'DELETE');rd:=public.request_student_deletion(d,'DELETE');
 perform public.cancel_student_deletion(rd);
 update public.student_deletion_requests set requested_at=now()-interval '31 days',delete_after=now()-interval '1 day' where id in (ra,rb,rd);
 insert into automated_qa_block values(b);
 result:=private.process_due_student_deletions();
 insert into automated_qa_result values
 ('due deletion completes',not exists(select 1 from public.students where id=a)),
 ('failed deletion rolls back',exists(select 1 from public.students where id=b)),
 ('early request preserved',exists(select 1 from public.students where id=c)),
 ('cancelled request preserved',exists(select 1 from public.students where id=d)),
 ('batch continues around failed request',result='{"completed":1,"failed":1}'::jsonb),
 ('failure is tracked without message',exists(select 1 from private.student_deletion_attempts where request_id=rb and outcome='failed' and error_code='23503'));
 delete from automated_qa_block;
 result:=private.process_due_student_deletions();
 insert into automated_qa_result values
 ('retry succeeds',not exists(select 1 from public.students where id=b) and exists(select 1 from private.student_deletion_attempts where request_id=rb and outcome='completed' and error_code is null and attempts=2)),
 ('completed request is not repeated',exists(select 1 from private.student_deletion_attempts where request_id=ra and attempts=1)),
 ('nothing due is harmless',private.process_due_student_deletions()='{"completed":0,"failed":0}'::jsonb),
 ('public clients cannot run job',not has_function_privilege('authenticated','private.process_due_student_deletions()','execute') and not has_function_privilege('anon','private.process_due_student_deletions()','execute'));
 if exists(select 1 from automated_qa_result where not passed) then raise exception 'Automation QA failed'; end if;
end $$;
select * from automated_qa_result;
