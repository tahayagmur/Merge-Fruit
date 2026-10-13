-- AI HQ — Phase 2 core data model (additive; Phase 1 objects keep working)
--
-- Adds
--   profiles + workspace roles (owner / admin / member)
--   system_settings (single row: workspace name, time zone)
--   integration_configs (non-secret settings per integration; secrets stay in env)
--   agent_definitions + agent_task_records
--   workflow metadata on automations (provider-agnostic external workflow reference)
--   is_demo flags so demo data is always distinguishable from real data
--
-- Rollback: supabase/rollback/20261014120000_phase2_core_down.sql

-- ---------------------------------------------------------------------------
-- Profiles and workspace roles
-- ---------------------------------------------------------------------------

create type public.workspace_role as enum ('owner', 'admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(btrim(display_name)) between 1 and 80),
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Role is changed only through set_workspace_role().';

create index profiles_role_idx on public.profiles (role);

-- Role of the current user; NULL when there is no profile (or no session).
create function public.workspace_role_of_current_user()
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create function public.is_workspace_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.workspace_role_of_current_user() in ('owner', 'admin'), false)
$$;

-- New auth users get a profile. The very first profile becomes the owner;
-- everyone after that starts as a member.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role, created_at)
  values (
    new.id,
    new.email,
    (case when exists (select 1 from public.profiles where role = 'owner') then 'member' else 'owner' end)::public.workspace_role,
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email, updated_at = now() where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- Backfill users created before this migration; the oldest becomes owner.
insert into public.profiles (id, email, role, created_at)
select u.id, u.email, 'member'::public.workspace_role, coalesce(u.created_at, now())
from auth.users u
on conflict (id) do nothing;

update public.profiles
set role = 'owner'
where id = (select id from public.profiles order by created_at, id limit 1)
  and not exists (select 1 from public.profiles where role = 'owner');

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- System settings (exactly one row)
-- ---------------------------------------------------------------------------

create table public.system_settings (
  id boolean primary key default true check (id),
  workspace_name text not null default 'AI HQ' check (char_length(btrim(workspace_name)) between 1 and 60),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.system_settings is 'Workspace-wide settings. Readable by every signed-in user, writable by admins.';

insert into public.system_settings default values;

create function public.validate_system_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Raises invalid_parameter_value for unknown time zones.
  perform now() at time zone new.timezone;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger system_settings_validate
  before insert or update on public.system_settings
  for each row execute function public.validate_system_settings();

-- "Today" in the workspace time zone; used for due / overdue logic.
create function public.workspace_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce((select s.timezone from public.system_settings s where s.id), 'UTC'))::date
$$;

-- ---------------------------------------------------------------------------
-- Integration configurations (non-secret settings only)
-- ---------------------------------------------------------------------------

create table public.integration_configs (
  key text primary key check (key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 16384),
  -- Written only by a real connection test (service role / future connector).
  -- Users have no privilege on these columns, so "connected" cannot be faked.
  last_test_status text check (last_test_status in ('succeeded', 'failed')),
  last_test_message text check (char_length(last_test_message) <= 500),
  last_tested_at timestamptz,
  tested_settings_hash text check (char_length(tested_settings_hash) <= 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.integration_configs is
  'Per-integration non-secret settings. Secrets live in server environment variables, never here.';

create function public.touch_integration_config()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger integration_configs_touch
  before insert or update on public.integration_configs
  for each row execute function public.touch_integration_config();

-- ---------------------------------------------------------------------------
-- Demo data flags
-- ---------------------------------------------------------------------------

alter table public.projects add column is_demo boolean not null default false;
alter table public.tasks add column is_demo boolean not null default false;
alter table public.automations add column is_demo boolean not null default false;

-- Phase 1 seed data used a name prefix; carry it over to the flag.
update public.projects set is_demo = true where name like '[Demo] %';
update public.tasks t set is_demo = true from public.projects p where p.id = t.project_id and p.is_demo;
update public.automations set is_demo = true where name like '[Demo] %';

-- ---------------------------------------------------------------------------
-- Workflow metadata: provider-agnostic external workflow reference
-- ---------------------------------------------------------------------------

alter table public.automations rename column n8n_workflow_id to external_workflow_id;
alter table public.automations rename constraint automations_n8n_workflow_id_check to automations_external_workflow_id_check;
alter table public.automations add column provider text check (provider ~ '^[a-z][a-z0-9_-]{1,39}$');
update public.automations set provider = 'n8n' where external_workflow_id is not null;
alter table public.automations
  add constraint automations_external_workflow_requires_provider
  check (external_workflow_id is null or provider is not null);

-- ---------------------------------------------------------------------------
-- AI agents
-- ---------------------------------------------------------------------------

create type public.agent_status as enum ('draft', 'ready', 'disabled');
create type public.agent_task_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table public.agent_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 1000),
  instructions text not null default '' check (char_length(instructions) <= 20000),
  -- Integration key of the model provider (e.g. "anthropic"); NULL = not assigned.
  provider text check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  model text check (char_length(btrim(model)) between 1 and 100),
  capabilities text[] not null default '{}' check (cardinality(capabilities) <= 20),
  status public.agent_status not null default 'draft',
  version integer not null default 1 check (version >= 1),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_definitions_id_owner_key unique (id, owner_id)
);

comment on table public.agent_definitions is 'AI agent definitions. Nothing runs them in Phase 2.';

create index agent_definitions_owner_updated_idx on public.agent_definitions (owner_id, updated_at desc);

create table public.agent_task_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  agent_id uuid not null,
  project_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  input text not null default '' check (char_length(input) <= 20000),
  status public.agent_task_status not null default 'queued',
  agent_version integer not null default 1,
  output text check (char_length(output) <= 100000),
  error_message text check (char_length(error_message) <= 2000),
  started_at timestamptz,
  completed_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_task_records_agent_owner_fkey foreign key (agent_id, owner_id)
    references public.agent_definitions (id, owner_id) on delete cascade,
  constraint agent_task_records_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);

comment on table public.agent_task_records is
  'Work items for agents. Users can queue and cancel; only an agent runtime may record results.';

create index agent_task_records_agent_created_idx on public.agent_task_records (agent_id, created_at desc);
create index agent_task_records_owner_status_idx on public.agent_task_records (owner_id, status);

-- Bump the definition version whenever its behaviour changes.
create function public.bump_agent_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.instructions, new.provider, new.model, new.capabilities)
     is distinct from (old.instructions, old.provider, old.model, old.capabilities) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;

create trigger agent_definitions_bump_version
  before update on public.agent_definitions
  for each row execute function public.bump_agent_version();

create trigger agent_definitions_set_updated_at
  before update on public.agent_definitions
  for each row execute function public.set_updated_at();

-- Lifecycle rules for task records, enforced for requests made as a signed-in
-- user. A future agent runtime (service role) records progress and results.
create function public.guard_agent_task_record()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_agent public.agent_definitions;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select * into v_agent from public.agent_definitions a where a.id = new.agent_id;
    if v_agent.id is not null and v_agent.status <> 'ready' then
      raise exception 'The agent must be Ready to accept tasks.' using errcode = 'AHQ01';
    end if;
    if new.status <> 'queued' or new.output is not null or new.error_message is not null
       or new.started_at is not null or new.completed_at is not null then
      raise exception 'New agent tasks start as queued without results.' using errcode = 'AHQ01';
    end if;
    new.agent_version := coalesce(v_agent.version, 1);
    return new;
  end if;

  -- UPDATE
  if (new.output, new.error_message, new.started_at, new.agent_id, new.agent_version)
     is distinct from (old.output, old.error_message, old.started_at, old.agent_id, old.agent_version) then
    raise exception 'Only the agent runtime can record task results.' using errcode = 'AHQ01';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'queued' and new.status = 'cancelled' then
      new.completed_at := now();
    else
      raise exception 'A task can only be cancelled while it is queued.' using errcode = 'AHQ01';
    end if;
  elsif new.completed_at is distinct from old.completed_at then
    raise exception 'Only the agent runtime can record task results.' using errcode = 'AHQ01';
  end if;

  if old.status <> 'queued' and (new.title, new.input, new.project_id) is distinct from (old.title, old.input, old.project_id) then
    raise exception 'Only queued tasks can be edited.' using errcode = 'AHQ01';
  end if;

  return new;
end;
$$;

create trigger agent_task_records_guard
  before insert or update on public.agent_task_records
  for each row execute function public.guard_agent_task_record();

create trigger agent_task_records_set_updated_at
  before update on public.agent_task_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Activity log: new entity types
-- ---------------------------------------------------------------------------

alter table public.activity_logs drop constraint activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check
  check (entity_type in ('project', 'task', 'automation', 'agent', 'agent_task', 'profile', 'system_settings', 'integration'));
-- Workspace-level rows (settings, integrations) have no uuid id.
alter table public.activity_logs alter column entity_id drop not null;

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
  v_noun text;
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

  -- Workspace-level rows are logged in the feed of the user who changed them.
  if v_entity in ('system_settings', 'integration') then
    v_owner := auth.uid();
    if v_owner is null then
      return null;
    end if;
  else
    v_owner := (v_row ->> 'owner_id')::uuid;
  end if;

  -- The owner is being deleted (cascade from auth.users): nothing to log.
  if not exists (select 1 from auth.users u where u.id = v_owner) then
    return null;
  end if;

  -- Children removed together with their parent are covered by the parent's entry.
  if tg_op = 'DELETE' and v_entity = 'task'
     and not exists (select 1 from public.projects p where p.id = (v_row ->> 'project_id')::uuid) then
    return null;
  end if;
  if tg_op = 'DELETE' and v_entity = 'agent_task'
     and not exists (select 1 from public.agent_definitions a where a.id = (v_row ->> 'agent_id')::uuid) then
    return null;
  end if;

  v_noun := case v_entity
    when 'agent_task' then 'Agent task'
    when 'system_settings' then 'Workspace settings'
    when 'integration' then 'Integration'
    else initcap(v_entity)
  end;
  v_label := coalesce(v_row ->> 'name', v_row ->> 'title', v_row ->> 'key', v_row ->> 'workspace_name', '');

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_summary := v_noun || ' created: ' || v_label;
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_summary := v_noun || ' deleted: ' || v_label;
  else
    v_old := to_jsonb(old);

    select array_agg(n.key order by n.key)
      into v_changed
      from jsonb_each(v_row) as n (key, value)
     where n.key not in ('updated_at', 'created_at', 'completed_at', 'updated_by', 'version')
       and (v_old -> n.key) is distinct from n.value;

    if v_changed is null then
      return null;
    end if;

    if 'status' = any (v_changed) then
      v_action := 'status_changed';
      v_summary := v_noun || ' ' || v_label || ': '
        || replace(v_old ->> 'status', '_', ' ') || ' -> ' || replace(v_row ->> 'status', '_', ' ');
      v_metadata := jsonb_build_object('from', v_old ->> 'status', 'to', v_row ->> 'status');
    else
      v_action := 'updated';
      v_summary := v_noun || ' updated: ' || v_label;
    end if;

    -- Never copy setting values into the log, only which fields changed.
    v_metadata := v_metadata || jsonb_build_object('changed', to_jsonb(v_changed));
  end if;

  if v_entity in ('task', 'automation', 'agent_task') and v_row ->> 'project_id' is not null then
    v_metadata := v_metadata || jsonb_build_object('project_id', v_row ->> 'project_id');
  end if;
  if v_entity = 'agent_task' then
    v_metadata := v_metadata || jsonb_build_object('agent_id', v_row ->> 'agent_id');
  end if;
  if v_entity = 'integration' then
    v_metadata := v_metadata || jsonb_build_object('key', v_row ->> 'key');
  end if;

  insert into public.activity_logs (owner_id, actor_id, entity_type, entity_id, action, summary, metadata)
  values (
    v_owner,
    auth.uid(),
    v_entity,
    case when v_entity in ('system_settings', 'integration') then null else (v_row ->> 'id')::uuid end,
    v_action,
    left(v_summary, 300),
    v_metadata
  );

  return null;
end;
$$;

create trigger agent_definitions_log_activity
  after insert or update or delete on public.agent_definitions
  for each row execute function public.log_activity('agent');

create trigger agent_task_records_log_activity
  after insert or update or delete on public.agent_task_records
  for each row execute function public.log_activity('agent_task');

create trigger system_settings_log_activity
  after update on public.system_settings
  for each row execute function public.log_activity('system_settings');

create trigger integration_configs_log_activity
  after insert or update or delete on public.integration_configs
  for each row execute function public.log_activity('integration');

-- ---------------------------------------------------------------------------
-- Role management (owner only)
-- ---------------------------------------------------------------------------

create function public.set_workspace_role(target_user uuid, new_role public.workspace_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles;
begin
  if public.workspace_role_of_current_user() is distinct from 'owner' then
    raise exception 'Only the workspace owner can change roles.' using errcode = '42501';
  end if;

  select * into v_target from public.profiles where id = target_user for update;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if v_target.role = 'owner' and new_role <> 'owner'
     and (select count(*) from public.profiles where role = 'owner') <= 1 then
    raise exception 'The workspace needs at least one owner.' using errcode = 'AHQ01';
  end if;

  update public.profiles set role = new_role where id = target_user returning * into v_target;

  insert into public.activity_logs (owner_id, actor_id, entity_type, entity_id, action, summary, metadata)
  values (
    auth.uid(),
    auth.uid(),
    'profile',
    target_user,
    'updated',
    left('Role of ' || coalesce(v_target.email, 'user') || ' set to ' || new_role, 300),
    jsonb_build_object('role', new_role)
  );

  return v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read models (replace Phase 1 versions)
-- ---------------------------------------------------------------------------

create or replace view public.project_overview
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
  (count(t.id) filter (where t.status <> 'done' and t.due_date < public.workspace_today()))::integer as task_overdue,
  p.is_demo
from public.projects p
left join public.tasks t on t.project_id = p.id
group by p.id;

drop function public.command_center_summary();

create function public.command_center_summary(include_demo boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select auth.uid() as id, public.workspace_today() as today)
  select jsonb_build_object(
    'projects_total', (select count(*) from public.projects p, me
                        where p.owner_id = me.id and p.status <> 'archived' and (include_demo or not p.is_demo)),
    'projects_active', (select count(*) from public.projects p, me
                         where p.owner_id = me.id and p.status = 'active' and (include_demo or not p.is_demo)),
    'tasks_open', (select count(*) from public.tasks t, me
                    where t.owner_id = me.id and t.status <> 'done' and (include_demo or not t.is_demo)),
    'tasks_in_progress', (select count(*) from public.tasks t, me
                           where t.owner_id = me.id and t.status = 'in_progress' and (include_demo or not t.is_demo)),
    'tasks_blocked', (select count(*) from public.tasks t, me
                       where t.owner_id = me.id and t.status = 'blocked' and (include_demo or not t.is_demo)),
    'tasks_overdue', (select count(*) from public.tasks t, me
                       where t.owner_id = me.id and t.status <> 'done' and t.due_date < me.today
                         and (include_demo or not t.is_demo)),
    'tasks_done_last_7_days', (select count(*) from public.tasks t, me
                                where t.owner_id = me.id and t.status = 'done'
                                  and t.completed_at >= now() - interval '7 days' and (include_demo or not t.is_demo)),
    'automations_total', (select count(*) from public.automations a, me
                           where a.owner_id = me.id and (include_demo or not a.is_demo)),
    'agents_total', (select count(*) from public.agent_definitions a, me
                      where a.owner_id = me.id and (include_demo or not a.is_demo)),
    'agents_ready', (select count(*) from public.agent_definitions a, me
                      where a.owner_id = me.id and a.status = 'ready' and (include_demo or not a.is_demo)),
    'agent_tasks_queued', (select count(*) from public.agent_task_records r, me
                            where r.owner_id = me.id and r.status = 'queued' and (include_demo or not r.is_demo)),
    'demo_records', (select
                       (select count(*) from public.projects p, me where p.owner_id = me.id and p.is_demo)
                     + (select count(*) from public.tasks t, me where t.owner_id = me.id and t.is_demo)
                     + (select count(*) from public.automations a, me where a.owner_id = me.id and a.is_demo)
                     + (select count(*) from public.agent_definitions a, me where a.owner_id = me.id and a.is_demo)
                     + (select count(*) from public.agent_task_records r, me where r.owner_id = me.id and r.is_demo)),
    'today', (select today from me)
  )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.integration_configs enable row level security;
alter table public.agent_definitions enable row level security;
alter table public.agent_task_records enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_workspace_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy system_settings_select on public.system_settings
  for select to authenticated using (true);
create policy system_settings_update_admin on public.system_settings
  for update to authenticated
  using ((select public.is_workspace_admin())) with check ((select public.is_workspace_admin()));

create policy integration_configs_select on public.integration_configs
  for select to authenticated using (true);
create policy integration_configs_insert_admin on public.integration_configs
  for insert to authenticated with check ((select public.is_workspace_admin()));
create policy integration_configs_update_admin on public.integration_configs
  for update to authenticated
  using ((select public.is_workspace_admin())) with check ((select public.is_workspace_admin()));
create policy integration_configs_delete_admin on public.integration_configs
  for delete to authenticated using ((select public.is_workspace_admin()));

create policy agent_definitions_select_own on public.agent_definitions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy agent_definitions_insert_own on public.agent_definitions
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy agent_definitions_update_own on public.agent_definitions
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy agent_definitions_delete_own on public.agent_definitions
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy agent_task_records_select_own on public.agent_task_records
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy agent_task_records_insert_own on public.agent_task_records
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy agent_task_records_update_own on public.agent_task_records
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy agent_task_records_delete_own on public.agent_task_records
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on table public.profiles, public.system_settings, public.integration_configs,
  public.agent_definitions, public.agent_task_records from anon, public, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on table public.system_settings to authenticated;
grant update (workspace_name, timezone) on table public.system_settings to authenticated;

grant select on table public.integration_configs to authenticated;
grant insert (key, enabled, settings) on table public.integration_configs to authenticated;
grant update (enabled, settings) on table public.integration_configs to authenticated;
grant delete on table public.integration_configs to authenticated;

grant select, insert, update, delete on table public.agent_definitions, public.agent_task_records to authenticated;

-- The view was recreated: re-apply its grants.
revoke all on table public.project_overview from anon, public;
grant select on table public.project_overview to authenticated;

revoke execute on function public.command_center_summary(boolean) from anon, public;
grant execute on function public.command_center_summary(boolean) to authenticated;
revoke execute on function public.set_workspace_role(uuid, public.workspace_role) from anon, public;
grant execute on function public.set_workspace_role(uuid, public.workspace_role) to authenticated;
revoke execute on function public.workspace_role_of_current_user() from anon, public;
grant execute on function public.workspace_role_of_current_user() to authenticated;
revoke execute on function public.is_workspace_admin() from anon, public;
grant execute on function public.is_workspace_admin() to authenticated;
revoke execute on function public.workspace_today() from anon, public;
grant execute on function public.workspace_today() to authenticated;

revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;
revoke execute on function public.sync_profile_email() from anon, authenticated, public;
revoke execute on function public.validate_system_settings() from anon, authenticated, public;
revoke execute on function public.touch_integration_config() from anon, authenticated, public;
revoke execute on function public.bump_agent_version() from anon, authenticated, public;
revoke execute on function public.guard_agent_task_record() from anon, authenticated, public;
revoke execute on function public.log_activity() from anon, authenticated, public;
