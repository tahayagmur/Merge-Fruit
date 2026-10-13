-- AI HQ — workspace audit view
--
-- Owners and admins may READ every activity log entry in the workspace, so the
-- audit trail covers all users (settings, integrations, roles, projects,
-- agents...). Writing stays impossible for everyone: rows are only inserted by
-- the SECURITY DEFINER logging functions, and no role has insert/update/delete.
--
-- Members keep seeing only their own entries (activity_logs_select_own).
-- Rollback: supabase/rollback/20261015120000_workspace_audit_down.sql

create policy activity_logs_select_admin on public.activity_logs
  for select to authenticated
  using ((select public.is_workspace_admin()));

comment on policy activity_logs_select_admin on public.activity_logs is
  'Workspace audit: owners and admins read every entry; nobody can write.';
