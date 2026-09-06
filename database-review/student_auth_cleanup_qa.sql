begin;
set local statement_timeout='25s';
do $qa$
declare o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 x uuid:=gen_random_uuid(); y uuid:=gen_random_uuid(); upgraded uuid:=gen_random_uuid(); session_x uuid:=gen_random_uuid(); session_y uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,is_anonymous) values(o,'authenticated','authenticated',false),(x,'authenticated','authenticated',true),(y,'authenticated','authenticated',true),(upgraded,'authenticated','authenticated',false);
 insert into public.students(id,owner_user_id,display_name) values(a,o,'Fictional target'),(b,o,'Fictional control');
 insert into public.classes(id,owner_user_id,name,class_code) values(c,o,'Fictional class','QA'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)));
 insert into public.class_memberships(class_id,student_id,owner_user_id) values(c,a,o),(c,b,o);
 insert into public.student_auth_links(auth_user_id,student_id,owner_user_id,class_id) values(x,a,o,c),(y,b,o,c),(upgraded,a,o,c);
 insert into auth.sessions(id,user_id) values(session_x,x),(session_y,y);
 insert into auth.refresh_tokens(user_id,token,session_id) values(x::text,gen_random_uuid()::text,session_x),(y::text,gen_random_uuid()::text,session_y);
 update public.students set archived_at=now() where id=a;
 if not exists(select 1 from auth.users where id=x) then raise exception 'Archive deleted auth account'; end if;
 delete from public.students where id=a and owner_user_id=o;
 if exists(select 1 from auth.users where id=x) or exists(select 1 from auth.sessions where user_id=x) or exists(select 1 from auth.refresh_tokens where user_id=x::text) then raise exception 'Technical account/session cleanup failed'; end if;
 if not exists(select 1 from auth.users where id=upgraded) or not exists(select 1 from auth.users where id=o) then raise exception 'Permanent account affected'; end if;
 if not exists(select 1 from auth.sessions where id=session_y) or not exists(select 1 from auth.refresh_tokens where user_id=y::text) or not exists(select 1 from public.student_auth_links where auth_user_id=y) then raise exception 'Control affected'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',x,'is_anonymous',true,'role','authenticated')::text,true);
 if exists(select 1 from public.get_student_session_context()) then raise exception 'Deleted auth identity resolves student'; end if;

 if exists(select 1 from public.get_morphology_student_state()) then raise exception 'Morphology stale read returned data'; end if;
 begin perform public.save_morphology_student_state('{}'::jsonb,now()); raise exception 'Unexpected Morphology write success';
 exception when raise_exception then if sqlerrm<>'Morphology student access denied' then raise; end if; end;
 begin perform public.get_primo_student_state('progress'); raise exception 'Unexpected Primo read success';
 exception when insufficient_privilege then null; end;
 begin perform public.save_primo_student_state('progress','{}'::jsonb,null,gen_random_uuid()); raise exception 'Unexpected Primo write success';
 exception when insufficient_privilege then null; end;
 begin perform public.get_my_story_builder_student_draft(); raise exception 'Unexpected Story read success';
 exception when insufficient_privilege then null; end;
 begin perform public.save_my_story_builder_student_draft('{"version":1,"story":"Fictional test"}'::jsonb); raise exception 'Unexpected Story write success';
 exception when insufficient_privilege then null; end;
end $qa$;
select 'PASS: archive preserved account; permanent deletion removed anonymous account, sessions and refresh tokens; educator/upgraded account and control preserved; stale identity has no student context and all six tested product read/write operations deny access or return no data' as result;
rollback;
