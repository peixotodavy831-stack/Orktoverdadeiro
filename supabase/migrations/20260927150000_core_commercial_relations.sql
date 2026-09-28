-- Core commercial relationships are workspace-scoped and versioned.
-- Additive only: existing quotes/proposals retain their legacy IDs and content.

alter table public.orkto_deals
  add constraint orkto_deals_id_workspace_key unique (id, workspace_id);

alter table public.quotes
  add column if not exists customer_id uuid,
  add column if not exists deal_id uuid,
  add column if not exists archived_at timestamptz;

alter table public.proposals
  add column if not exists version integer not null default 1,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.orkto_conversations
  add column if not exists customer_id uuid,
  add column if not exists deal_id uuid;

-- Version/customer backfills are metadata-only, including expired proposals.
alter table public.quotes disable trigger guard_quote_retention;
alter table public.proposals disable trigger aaa_bind_proposal_retention;
do $$ declare t record; begin
 for t in select tgname from pg_trigger where tgrelid='public.proposals'::regclass
   and tgname in ('check_proposal_expiry_before_write','trg_check_proposal_expiry') loop
   execute format('alter table public.proposals disable trigger %I',t.tgname);
 end loop;
end $$;
with ranked_proposals as (
  select id, row_number() over (partition by quote_id, workspace_id order by created_at, id) as next_version
  from public.proposals
)
update public.proposals p set version = r.next_version
from ranked_proposals r where r.id = p.id;

-- Keep existing rows valid. Older quotes are linked to a customer only when an
-- unambiguous phone match exists inside the already-backfilled workspace.
with customer_matches as (
  select q.id as quote_id, c.id as customer_id,
    count(*) over (partition by q.id) as match_count
  from public.quotes q
  join public.clients c on c.workspace_id = q.workspace_id and c.phone = q.client_phone and c.archived_at is null
  where q.customer_id is null
)
update public.quotes q
set customer_id = matched.customer_id
from customer_matches matched
where matched.quote_id = q.id and matched.match_count = 1;
alter table public.quotes enable trigger guard_quote_retention;
alter table public.proposals enable trigger aaa_bind_proposal_retention;
do $$ declare t record; begin
 for t in select tgname from pg_trigger where tgrelid='public.proposals'::regclass
   and tgname in ('check_proposal_expiry_before_write','trg_check_proposal_expiry') loop
   execute format('alter table public.proposals enable trigger %I',t.tgname);
 end loop;
end $$;

alter table public.quotes
  add constraint quotes_customer_workspace_fkey
    foreign key (customer_id, workspace_id)
    references public.clients(id, workspace_id)
    on delete restrict,
  add constraint quotes_deal_workspace_fkey
    foreign key (deal_id, workspace_id)
    references public.orkto_deals(id, workspace_id)
    on delete restrict;

alter table public.orkto_conversations
  add constraint conversations_customer_workspace_fkey
    foreign key (customer_id, workspace_id)
    references public.clients(id, workspace_id)
    on delete restrict,
  add constraint conversations_deal_workspace_fkey
    foreign key (deal_id, workspace_id)
    references public.orkto_deals(id, workspace_id)
    on delete restrict;

alter table public.proposals
  add constraint proposals_version_positive_check check (version > 0),
  add constraint proposals_quote_version_workspace_key unique (quote_id, workspace_id, version);

create index if not exists quotes_workspace_deal_active_idx
  on public.quotes(workspace_id, deal_id, created_at desc) where archived_at is null;
create index if not exists quotes_workspace_customer_active_idx
  on public.quotes(workspace_id, customer_id, created_at desc) where archived_at is null;
create index if not exists proposals_workspace_quote_version_idx
  on public.proposals(workspace_id, quote_id, version desc);
create index if not exists conversations_workspace_customer_idx
  on public.orkto_conversations(workspace_id, customer_id, updated_at desc);
create index if not exists conversations_workspace_deal_idx
  on public.orkto_conversations(workspace_id, deal_id, updated_at desc);

create or replace function public.orkto_validate_conversation_relations()
returns trigger language plpgsql set search_path=public as $$
declare
  customer_phone text;
  deal_customer_ref text;
begin
  if new.customer_id is not null then
    select c.phone into customer_phone from public.clients c
    where c.id = new.customer_id and c.workspace_id = new.workspace_id and c.archived_at is null;
    if customer_phone is null then
      raise exception 'Cliente não pertence ao workspace da conversa ou está arquivado' using errcode='23503';
    end if;
    if new.contact_phone <> customer_phone then
      raise exception 'Telefone da conversa não corresponde ao cliente vinculado' using errcode='23514';
    end if;
  end if;
  if new.deal_id is not null then
    select d.customer_ref into deal_customer_ref from public.orkto_deals d
    where d.id = new.deal_id and d.workspace_id = new.workspace_id and d.status <> 'archived';
    if not found then
      raise exception 'Negócio não pertence ao workspace da conversa ou está arquivado' using errcode='23503';
    end if;
    if new.customer_id is not null and deal_customer_ref is not null
      and deal_customer_ref not in (new.customer_id::text, customer_phone) then
      raise exception 'Cliente e negócio da conversa não correspondem' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_validate_workspace_relations on public.orkto_conversations;
create trigger conversations_validate_workspace_relations
before insert or update of workspace_id, customer_id, deal_id, contact_phone
on public.orkto_conversations for each row execute function public.orkto_validate_conversation_relations();

create or replace function public.orkto_validate_quote_relations()
returns trigger language plpgsql set search_path=public as $$
declare
  customer_phone text;
  linked_customer_ref text;
begin
  if new.customer_id is not null then
    select c.phone into customer_phone
    from public.clients c
    where c.id = new.customer_id and c.workspace_id = new.workspace_id and c.archived_at is null;
    if customer_phone is null then
      raise exception 'Cliente não pertence ao workspace do orçamento ou está arquivado' using errcode='23503';
    end if;
  end if;

  if new.deal_id is not null then
    select d.customer_ref into linked_customer_ref
    from public.orkto_deals d
    where d.id = new.deal_id and d.workspace_id = new.workspace_id and d.status <> 'archived';
    if not found then
      raise exception 'Negócio não pertence ao workspace do orçamento ou está arquivado' using errcode='23503';
    end if;
    if new.customer_id is not null and linked_customer_ref is not null
      and linked_customer_ref not in (new.customer_id::text, customer_phone) then
      raise exception 'Cliente e negócio do orçamento não correspondem' using errcode='23503';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists quotes_validate_workspace_relations on public.quotes;
create trigger quotes_validate_workspace_relations
before insert or update of workspace_id, customer_id, deal_id, archived_at
on public.quotes for each row execute function public.orkto_validate_quote_relations();

alter table public.quotes enable row level security;
alter table public.proposals enable row level security;
grant all on public.quotes, public.proposals to service_role;
