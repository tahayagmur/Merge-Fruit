-- Reverts 20261015120000_workspace_audit.sql. Run BEFORE older rollback scripts
-- (the policy depends on public.is_workspace_admin() from the Phase 2 migration).
drop policy if exists activity_logs_select_admin on public.activity_logs;
