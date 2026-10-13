-- AI HQ — Phase 1 foundation schema
--
-- Tables : projects, tasks, automations, activity_logs
-- View   : project_overview (security invoker)
-- RPC    : command_center_summary() (security invoker)
--
-- Security model
--   * Every table has row level security enabled. A row belongs to exactly one
--     auth user (owner_id) and only that user can read or change it.
--   * tasks/automations reference projects through a composite (project_id,
--     owner_id) foreign key, so a row can never point at another user's project.
--   * activity_logs is append-only and written exclusively by triggers. Users
--     can read their own entries but cannot insert, update or delete them.
--   * The anon role gets no access to any of these objects.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.project_category as enum ('general', 'automation', 'game', 'saas', 'ai_agent');
create type public.task_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.priority_level as enum ('low', 'medium', 'high', 'critical');
create type public.automation_trigger as enum ('manual', 'schedule', 'webhook', 'event');
create type public.automation_status as enum ('draft', 'ready', 'paused');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  status public.project_status not null default 'planning',
  category public.project_category not null default 'general',
  priority public.priority_level not null default 'medium',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_id_owner_key unique (id, owner_id)
);

comment on table public.projects is 'AI HQ projects. One owner per row, protected by RLS.';

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  status public.task_status not null default 'todo',
  priority public.priority_level not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade
);

comment on table public.tasks is 'Tasks inside a project. owner_id must match the project owner.';

create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_owner_status_due_idx on public.tasks (owner_id, status, due_date);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  trigger_type public.automation_trigger not null default 'manual',
  trigger_notes text check (char_length(trigger_notes) <= 500),
  -- Optional reference to an n8n workflow id. Only an identifier, never a URL or
  -- secret: execution is wired up server-side in Phase 2.
  n8n_workflow_id text check (n8n_workflow_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  status public.automation_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automations_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);

comment on table public.automations is 'Automation definitions. Phase 1 stores drafts only; nothing is executed.';

create index automations_owner_updated_idx on public.automations (owner_id, updated_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  entity_type text not null check (entity_type in ('project', 'task', 'automation')),
  entity_id uuid not null,
  action text not null check (action in ('created', 'updated', 'status_changed', 'deleted')),
  summary text not null check (char_length(summary) <= 300),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is 'Append-only audit trail written by triggers. Read-only for users.';

create index activity_logs_owner_created_idx on public.activity_logs (owner_id, created_at desc, id desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Row maintenance triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;

create function public.sync_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    if tg_op = 'UPDATE' and old.status = 'done' then
      new.completed_at := old.completed_at;
    else
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger automations_set_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

create trigger tasks_sync_completed_at
  before insert or update on public.tasks
  for each row execute function public.sync_task_completed_at();

-- ---------------------------------------------------------------------------
-- Activity logging
-- ---------------------------------------------------------------------------

-- Writes one activity_logs row per change. SECURITY DEFINER so it can insert
-- into activity_logs, which users themselves cannot write to.
create function public.log_activity()
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
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_owner := (v_row ->> 'owner_id')::uuid;

  -- The owner is being deleted (cascade from auth.users): nothing to log.
  if not exists (select 1 from auth.users u where u.id = v_owner) then
    return null;
  end if;

  -- Tasks removed because their project was deleted are covered by the
  -- project's own "deleted" entry.
  if v_entity = 'task' and tg_op = 'DELETE'
     and not exists (select 1 from public.projects p where p.id = (v_row ->> 'project_id')::uuid) then
    return null;
  end if;

  v_label := coalesce(v_row ->> 'name', v_row ->> 'title', '');

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_summary := initcap(v_entity) || ' created: ' || v_label;
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_summary := initcap(v_entity) || ' deleted: ' || v_label;
  else
    v_old := to_jsonb(old);

    select array_agg(n.key order by n.key)
      into v_changed
      from jsonb_each(v_row) as n (key, value)
     where n.key not in ('updated_at', 'created_at', 'completed_at')
       and (v_old -> n.key) is distinct from n.value;

    if v_changed is null then
      return null;
    end if;

    if 'status' = any (v_changed) then
      v_action := 'status_changed';
      v_summary := initcap(v_entity) || ' ' || v_label || ': '
        || replace(v_old ->> 'status', '_', ' ') || ' -> ' || replace(v_row ->> 'status', '_', ' ');
      v_metadata := jsonb_build_object('from', v_old ->> 'status', 'to', v_row ->> 'status');
    else
      v_action := 'updated';
      v_summary := initcap(v_entity) || ' updated: ' || v_label;
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

create trigger projects_log_activity
  after insert or update or delete on public.projects
  for each row execute function public.log_activity('project');

create trigger tasks_log_activity
  after insert or update or delete on public.tasks
  for each row execute function public.log_activity('task');

create trigger automations_log_activity
  after insert or update or delete on public.automations
  for each row execute function public.log_activity('automation');

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------

-- Projects with task counters. security_invoker makes the view run with the
-- caller's privileges, so the RLS policies of projects and tasks still apply.
create view public.project_overview
with (security_invoker = true)
as
select
  p.id,
  p.owner_id,
  p.name,
  p.description,
  p.status,
  p.category,
  p.priority,
  p.due_date,
  p.created_at,
  p.updated_at,
  count(t.id)::integer as task_total,
  (count(t.id) filter (where t.status = 'done'))::integer as task_done,
  (count(t.id) filter (where t.status = 'blocked'))::integer as task_blocked,
  (count(t.id) filter (where t.status <> 'done' and t.due_date < current_date))::integer as task_overdue
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

create function public.command_center_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'projects_total', (select count(*) from public.projects p
                        where p.owner_id = (select auth.uid()) and p.status <> 'archived'),
    'projects_active', (select count(*) from public.projects p
                         where p.owner_id = (select auth.uid()) and p.status = 'active'),
    'tasks_open', (select count(*) from public.tasks t
                    where t.owner_id = (select auth.uid()) and t.status <> 'done'),
    'tasks_in_progress', (select count(*) from public.tasks t
                           where t.owner_id = (select auth.uid()) and t.status = 'in_progress'),
    'tasks_blocked', (select count(*) from public.tasks t
                       where t.owner_id = (select auth.uid()) and t.status = 'blocked'),
    'tasks_overdue', (select count(*) from public.tasks t
                       where t.owner_id = (select auth.uid()) and t.status <> 'done'
                         and t.due_date < current_date),
    'tasks_done_last_7_days', (select count(*) from public.tasks t
                                where t.owner_id = (select auth.uid()) and t.status = 'done'
                                  and t.completed_at >= now() - interval '7 days'),
    'automations_total', (select count(*) from public.automations a
                           where a.owner_id = (select auth.uid()))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.automations enable row level security;
alter table public.activity_logs enable row level security;

create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy tasks_delete_own on public.tasks
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy automations_select_own on public.automations
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy automations_insert_own on public.automations
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy automations_update_own on public.automations
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy automations_delete_own on public.automations
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Read-only for users; rows are only ever written by public.log_activity().
create policy activity_logs_select_own on public.activity_logs
  for select to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Privileges
-- Explicit grants so the schema works whether or not the project auto-exposes
-- new tables to the Data API roles.
-- ---------------------------------------------------------------------------

revoke all on table public.projects, public.tasks, public.automations, public.activity_logs,
  public.project_overview from anon, public;

grant select, insert, update, delete on table public.projects, public.tasks, public.automations
  to authenticated;
revoke insert, update, delete, truncate on table public.activity_logs from authenticated;
grant select on table public.activity_logs, public.project_overview to authenticated;

revoke execute on function public.command_center_summary() from anon, public;
grant execute on function public.command_center_summary() to authenticated;

revoke execute on function public.log_activity() from anon, authenticated, public;
revoke execute on function public.set_updated_at() from anon, authenticated, public;
revoke execute on function public.sync_task_completed_at() from anon, authenticated, public;
