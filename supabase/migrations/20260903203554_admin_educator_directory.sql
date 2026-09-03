-- Admin-only educator directory. Authentication metadata stays behind a
-- server-side administrator check and only the minimum fields are returned.

create or replace function public.list_educator_accounts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_entitlement_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'email', au.email,
      'display_name', ep.display_name,
      'created_at', au.created_at,
      'last_sign_in_at', au.last_sign_in_at,
      'active_product_keys', coalesce((
        select jsonb_agg(distinct pe.product_key order by pe.product_key)
        from public.product_entitlements pe
        where pe.owner_user_id = au.id
          and pe.status = 'active'
          and pe.starts_at <= now()
          and pe.expires_at > now()
      ), '[]'::jsonb)
    ) order by au.last_sign_in_at desc nulls last, au.created_at desc)
    from auth.users au
    left join public.educator_profiles ep on ep.user_id = au.id
    where coalesce(au.is_anonymous, false) = false
      and au.email is not null
  ), '[]'::jsonb);
end;
$function$;

revoke execute on function public.list_educator_accounts() from public, anon;
grant execute on function public.list_educator_accounts() to authenticated;
