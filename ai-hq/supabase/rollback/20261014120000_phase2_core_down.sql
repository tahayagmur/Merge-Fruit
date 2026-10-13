-- Rollback for 20261014120000_phase2_core.sql
--
-- WARNING: deletes Phase 2 data (profiles, settings, integration settings,
-- agents, agent tasks, demo flags). Take a backup first and roll the
-- application back to the Phase 1 build BEFORE running this.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/rollback/20261014120000_phase2_core_down.sql
--
-- Afterwards remove the migration record so the CLI does not consider it applied:
--   delete from supabase_migrations.schema_migrations where version = '20261014120000';

begin;

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_email_changed on auth.users;

drop function if exists public.set_workspace_role(uuid, public.workspace_role);
drop function if exists public.command_center_summary(boolean);

drop table if exists public.agent_task_records;
drop table if exists public.agent_definitions;
drop table if exists public.integration_configs;
drop table if exists public.system_settings;
drop table if exists public.profiles;

drop function if exists public.guard_agent_task_record();
drop function if exists public.bump_agent_version();
drop function if exists public.touch_integration_config();
drop function if exists public.validate_system_settings();
drop function if exists public.handle_new_auth_user();
drop function if exists public.sync_profile_email();
drop function if exists public.is_workspace_admin();
drop function if exists public.workspace_role_of_current_user();

drop type if exists public.agent_task_status;
drop type if exists public.agent_status;
drop type if exists public.workspace_role;

-- Workflow metadata back to the Phase 1 shape.
alter table public.automations drop constraint if exists automations_external_workflow_requires_provider;
alter table public.automations drop column if exists provider;
alter table public.automations rename constraint automations_external_workflow_id_check to automations_n8n_workflow_id_check;
alter table public.automations rename column external_workflow_id to n8n_workflow_id;

-- Phase 1 views/functions (dropped and recreated without is_demo / workspace_today).
drop view if exists public.project_overview;
alter table public.projects drop column if exists is_demo;
alter table public.tasks drop column if exists is_demo;
alter table public.automations drop column if exists is_demo;

create view public.project_overview
with (security_invoker = true)
as
select
  p.id, p.owner_id, p.name, p.description, p.status, p.category, p.priority, p.due_date,
  p.created_at, p.updated_at,
  count(t.id)::integer as task_total,
  (count(t.id) filter (where t.status = 'done'))::integer as task_done,
  (count(t.id) filter (where t.status = 'blocked'))::integer as task_blocked,
  (count(t.id) filter (where t.status <> 'done' and t.due_date < current_date))::integer as task_overdue
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;
revoke all on table public.project_overview from anon, public;
grant select on table public.project_overview to authenticated;

drop function if exists public.workspace_today();

create function public.command_center_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'projects_total', (select count(*) from public.projects p where p.owner_id = (select auth.uid()) and p.status <> 'archived'),
    'projects_active', (select count(*) from public.projects p where p.owner_id = (select auth.uid()) and p.status = 'active'),
    'tasks_open', (select count(*) from public.tasks t where t.owner_id = (select auth.uid()) and t.status <> 'done'),
    'tasks_in_progress', (select count(*) from public.tasks t where t.owner_id = (select auth.uid()) and t.status = 'in_progress'),
    'tasks_blocked', (select count(*) from public.tasks t where t.owner_id = (select auth.uid()) and t.status = 'blocked'),
    'tasks_overdue', (select count(*) from public.tasks t where t.owner_id = (select auth.uid()) and t.status <> 'done' and t.due_date < current_date),
    'tasks_done_last_7_days', (select count(*) from public.tasks t where t.owner_id = (select auth.uid()) and t.status = 'done' and t.completed_at >= now() - interval '7 days'),
    'automations_total', (select count(*) from public.automations a where a.owner_id = (select auth.uid()))
  );
$$;
revoke execute on function public.command_center_summary() from anon, public;
grant execute on function public.command_center_summary() to authenticated;

-- Activity log back to Phase 1 entity types (drops Phase 2 entries first).
delete from public.activity_logs
where entity_type not in ('project', 'task', 'automation') or entity_id is null;
alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('project', 'task', 'automation'));
alter table public.activity_logs alter column entity_id set not null;

-- Restore the Phase 1 log_activity() body.
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_row jsonb;
  v_old jsonb;
  v_owner uuid;
  v_label text;
  v_action text;
  v_summary text;
  v_metadata jsonb := '{}'::jsonb;
  v_changed text[];
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_owner := (v_row ->> 'owner_id')::uuid;
  if not exists (select 1 from auth.users u where u.id = v_owner) then return null; end if;
  if v_entity = 'task' and tg_op = 'DELETE'
     and not exists (select 1 from public.projects p where p.id = (v_row ->> 'project_id')::uuid) then
    return null;
  end if;
  v_label := coalesce(v_row ->> 'name', v_row ->> 'title', '');
  if tg_op = 'INSERT' then
    v_action := 'created'; v_summary := initcap(v_entity) || ' created: ' || v_label;
  elsif tg_op = 'DELETE' then
    v_action := 'deleted'; v_summary := initcap(v_entity) || ' deleted: ' || v_label;
  else
    v_old := to_jsonb(old);
    select array_agg(n.key order by n.key) into v_changed
      from jsonb_each(v_row) as n (key, value)
     where n.key not in ('updated_at', 'created_at', 'completed_at') and (v_old -> n.key) is distinct from n.value;
    if v_changed is null then return null; end if;
    if 'status' = any (v_changed) then
      v_action := 'status_changed';
      v_summary := initcap(v_entity) || ' ' || v_label || ': '
        || replace(v_old ->> 'status', '_', ' ') || ' -> ' || replace(v_row ->> 'status', '_', ' ');
      v_metadata := jsonb_build_object('from', v_old ->> 'status', 'to', v_row ->> 'status');
    else
      v_action := 'updated'; v_summary := initcap(v_entity) || ' updated: ' || v_label;
    end if;
    v_metadata := v_metadata || jsonb_build_object('changed', to_jsonb(v_changed));
  end if;
  if v_entity in ('task', 'automation') and v_row ->> 'project_id' is not null then
    v_metadata := v_metadata || jsonb_build_object('project_id', v_row ->> 'project_id');
  end if;
  insert into public.activity_logs (owner_id, actor_id, entity_type, entity_id, action, summary, metadata)
  values (v_owner, auth.uid(), v_entity, (v_row ->> 'id')::uuid, v_action, left(v_summary, 300), v_metadata);
  return null;
end;
$$;
revoke execute on function public.log_activity() from anon, authenticated, public;

commit;
