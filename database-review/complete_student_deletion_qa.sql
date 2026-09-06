begin;
set local statement_timeout='20s';
create temporary table deletion_blocker(student_id uuid) on commit drop;
create function pg_temp.qa_block_student_deletion() returns trigger language plpgsql as $qa_block$
begin
 if exists(select 1 from pg_temp.deletion_blocker where student_id=old.id) then
  raise exception 'Fictional QA simulated deletion failure' using errcode='23503';
 end if;
 return old;
end $qa_block$;
create trigger qa_completion_blocker before delete on public.students
for each row execute function pg_temp.qa_block_student_deletion();
create temporary table deletion_results(check_name text, passed boolean) on commit drop;
do $qa$
declare o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); s uuid; p text; lp uuid; target_profiles uuid[]; control_profiles uuid[]; outsider uuid:=gen_random_uuid(); standalone uuid; removed integer;
begin
 insert into auth.users(id,aud,role,is_anonymous) values(o,'authenticated','authenticated',false);
 insert into auth.users(id,aud,role,is_anonymous) values(outsider,'authenticated','authenticated',false);
 insert into public.students(id,owner_user_id,display_name) values(a,o,'Deletion QA Owl'),(b,o,'Deletion QA Control');
 foreach s in array array[a,b] loop
  foreach p in array array['first-volo-morphology','primo-volo'] loop
   insert into public.learner_profiles(owner_user_id,student_id,local_profile_id,display_name,product_key)
   values(o,s,'qa-'||gen_random_uuid()::text,'Fictional QA',p) returning id into lp;
   insert into public.learning_state(learner_profile_id,product_key,store_key,data) values(lp,p,'privacy-qa','{"fictional":true}');
  end loop;
  insert into public.story_builder_student_cycles(student_id,owner_user_id) values(s,o);
  insert into public.story_builder_student_drafts(student_id,owner_user_id,draft) values(s,o,'{"fictional":true}');
  insert into public.story_builder_student_supports(student_id,owner_user_id,show_image_labels) values(s,o,true);
 end loop;
 update public.students set archived_at=now() where id=a;
 update public.learner_profiles set deleted_at=now() where student_id=a;
 insert into public.learner_profiles(owner_user_id,local_profile_id,display_name,product_key) values(o,'qa-standalone-'||gen_random_uuid()::text,'Fictional standalone','primo-volo') returning id into standalone;
 insert into public.learning_state(learner_profile_id,product_key,store_key,data) values(standalone,'primo-volo','privacy-qa','{"fictional":true}');
 begin
  perform private.complete_student_deletion(outsider,a,'DELETE '||a::text);
  raise exception 'Wrong owner accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform private.complete_student_deletion(o,a,null);
  raise exception 'Missing confirmation accepted';
 exception when invalid_parameter_value then null; end;
 insert into deletion_results values('wrong owner and missing confirmation preserve target',exists(select 1 from public.students where id=a));
 select array_agg(id) into target_profiles from public.learner_profiles where owner_user_id=o and student_id=a;
 select array_agg(id) into control_profiles from public.learner_profiles where owner_user_id=o and student_id=b;
 insert into deletion_blocker values(a);
 begin
  perform private.complete_student_deletion(o,a,'DELETE '||a::text);
  raise exception 'Expected deletion failure did not occur';
 exception when foreign_key_violation then null; end;
 insert into deletion_results values('failure rolls back profile and learning-state removal',
  (select count(*)=2 from public.learner_profiles where id=any(target_profiles))
  and (select count(*)=2 from public.learning_state where learner_profile_id=any(target_profiles))
  and exists(select 1 from public.students where id=a));
 delete from deletion_blocker where student_id=a;
 perform private.complete_student_deletion(o,a,'DELETE '||a::text);
 begin
  perform private.complete_student_deletion(o,a,'DELETE '||a::text);
  raise exception 'Duplicate completion accepted';
 exception when invalid_parameter_value then null; end;
 insert into deletion_results values('duplicate completion rejected',true);
 insert into deletion_results values
 ('standalone unlinked profile and state preserved',exists(select 1 from public.learner_profiles where id=standalone) and exists(select 1 from public.learning_state where learner_profile_id=standalone)),
 ('selected archived student removed',not exists(select 1 from public.students where id=a)),
 ('selected soft-deleted linked profiles removed',not exists(select 1 from public.learner_profiles where id=any(target_profiles))),
 ('selected learning state removed',not exists(select 1 from public.learning_state where learner_profile_id=any(target_profiles))),
 ('selected Story cycle draft and supports removed',not exists(select 1 from public.story_builder_student_cycles where student_id=a) and not exists(select 1 from public.story_builder_student_drafts where student_id=a) and not exists(select 1 from public.story_builder_student_supports where student_id=a)),
 ('control student and both profiles preserved',exists(select 1 from public.students where id=b) and (select count(*)=2 from public.learner_profiles where id=any(control_profiles))),
 ('control learning state preserved',(select count(*)=2 from public.learning_state where learner_profile_id=any(control_profiles))),
 ('control Story records preserved',exists(select 1 from public.story_builder_student_cycles where student_id=b) and exists(select 1 from public.story_builder_student_drafts where student_id=b) and exists(select 1 from public.story_builder_student_supports where student_id=b));
 if exists(select 1 from deletion_results where not passed) then raise exception 'Deletion assertion failed'; end if;
end $qa$;
insert into deletion_results
select 'public client roles cannot execute completion',
 not has_function_privilege('anon','private.complete_student_deletion(uuid,uuid,text)','execute')
 and not has_function_privilege('authenticated','private.complete_student_deletion(uuid,uuid,text)','execute')
 and not has_function_privilege('service_role','private.complete_student_deletion(uuid,uuid,text)','execute');
do $$ begin if exists(select 1 from deletion_results where not passed) then raise exception 'Failed'; end if; end $$;
select * from deletion_results order by check_name;
rollback;
