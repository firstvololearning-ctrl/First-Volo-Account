-- REVIEW RECORD of live migration 20260901153704.
-- Add the FK-covering index and initialize Auth helpers once per RLS statement.

begin;

create index class_product_access_class_owner_idx
  on public.class_product_access (class_id, owner_user_id);

drop policy class_product_access_educator_select
  on public.class_product_access;

create policy class_product_access_educator_select
on public.class_product_access
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and ((select auth.jwt())->>'is_anonymous')::boolean is false
);

commit;
