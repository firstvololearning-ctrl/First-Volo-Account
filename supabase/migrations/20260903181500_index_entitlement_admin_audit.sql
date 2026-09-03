create index if not exists entitlement_admin_audit_actor_created_idx
  on private.entitlement_admin_audit (actor_user_id, created_at desc);

create index if not exists entitlement_admin_audit_target_created_idx
  on private.entitlement_admin_audit (target_user_id, created_at desc);
