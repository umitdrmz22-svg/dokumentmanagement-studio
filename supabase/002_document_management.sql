-- Dokumentenmanagement Studio
-- Voraussetzung: zuerst 001_core_and_kataster.sql aus dem Gefahrstoffkataster-Repository ausführen.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_number text not null,
  title text not null,
  document_type text not null,
  category text not null default '',
  department text not null default '',
  status text not null default 'draft' check(status in ('draft','in_review','awaiting_approval','changes_requested','approved','obsolete','archived')),
  revision_label text not null default '0',
  current_version integer not null default 0 check(current_version>=0),
  valid_from date,
  review_due date,
  document_owner uuid references auth.users(id),
  creator_user_id uuid not null references auth.users(id),
  reviewer_user_id uuid references auth.users(id),
  approver_user_id uuid references auth.users(id),
  confidentiality text not null default 'intern' check(confidentiality in ('öffentlich','intern','vertraulich','streng vertraulich')),
  keywords text[] not null default '{}',
  current_file_path text not null default '',
  current_file_name text not null default '',
  current_mime_type text not null default '',
  approved_at timestamptz,
  obsolete_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,document_number)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null check(version_number>0),
  revision_label text not null,
  file_path text not null,
  original_file_name text not null,
  mime_type text not null default '',
  file_size bigint,
  change_note text not null,
  immutable boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(document_id,version_number)
);

create table if not exists public.document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  from_status text,
  to_status text,
  comment text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.dms_document_insert_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.document_events(document_id,actor_user_id,event_type,to_status,comment)
  values(new.id,auth.uid(),'created',new.status,'Dokument angelegt');
  return new;
end; $$;
drop trigger if exists documents_insert_event on public.documents;
create trigger documents_insert_event after insert on public.documents for each row execute function public.dms_document_insert_event();

create or replace function public.dms_version_inserted()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.documents set current_version=new.version_number,current_file_path=new.file_path,current_file_name=new.original_file_name,current_mime_type=new.mime_type,updated_at=now() where id=new.document_id;
  insert into public.document_events(document_id,actor_user_id,event_type,comment,metadata)
  values(new.document_id,auth.uid(),'version_added',new.change_note,jsonb_build_object('version',new.version_number,'revision',new.revision_label,'file',new.original_file_name));
  return new;
end; $$;
drop trigger if exists document_version_inserted on public.document_versions;
create trigger document_version_inserted after insert on public.document_versions for each row execute function public.dms_version_inserted();

create or replace function public.dms_set_updated_at()
returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at before update on public.documents for each row execute function public.dms_set_updated_at();

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_events enable row level security;

drop policy if exists documents_select_member on public.documents;
create policy documents_select_member on public.documents for select to authenticated using(public.is_org_member(organization_id));
drop policy if exists documents_insert_creator on public.documents;
create policy documents_insert_creator on public.documents for insert to authenticated with check(public.has_org_role(organization_id,array['owner','admin','ersteller']) and creator_user_id=auth.uid());
drop policy if exists documents_update_draft on public.documents;
create policy documents_update_draft on public.documents for update to authenticated using(status in ('draft','changes_requested') and public.has_org_role(organization_id,array['owner','admin','ersteller'])) with check(status in ('draft','changes_requested') and public.has_org_role(organization_id,array['owner','admin','ersteller']));
drop policy if exists documents_delete_admin on public.documents;
create policy documents_delete_admin on public.documents for delete to authenticated using(public.has_org_role(organization_id,array['owner','admin']));

drop policy if exists versions_select_member on public.document_versions;
create policy versions_select_member on public.document_versions for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and public.is_org_member(d.organization_id)));
drop policy if exists versions_insert_draft on public.document_versions;
create policy versions_insert_draft on public.document_versions for insert to authenticated with check(exists(select 1 from public.documents d where d.id=document_id and d.status in ('draft','changes_requested') and public.has_org_role(d.organization_id,array['owner','admin','ersteller'])));
drop policy if exists events_select_member on public.document_events;
create policy events_select_member on public.document_events for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id and public.is_org_member(d.organization_id)));

revoke all on public.documents,public.document_versions,public.document_events from anon;
grant select,insert,delete on public.documents to authenticated;
grant update(title,document_type,category,department,revision_label,valid_from,review_due,document_owner,reviewer_user_id,approver_user_id,confidentiality,keywords,updated_at) on public.documents to authenticated;
grant select,insert on public.document_versions to authenticated;
grant select on public.document_events to authenticated;

create or replace function public.dms_role_of(org uuid,target uuid)
returns text language sql stable security definer set search_path=public as $$select role from public.organization_members where organization_id=org and user_id=target and status='active' limit 1$$;

create or replace function public.submit_document(target_document uuid,note text default '')
returns public.documents language plpgsql security definer set search_path=public as $$
declare d public.documents; rr text; ar text; old_status text;
begin
 select * into d from public.documents where id=target_document for update;
 if d.id is null or d.status not in ('draft','changes_requested') then raise exception 'Ungültiger Dokumentstatus'; end if;
 old_status:=d.status;
 if not public.has_org_role(d.organization_id,array['owner','admin','ersteller']) then raise exception 'Keine Berechtigung'; end if;
 if d.current_file_path='' then raise exception 'Eine Dokumentdatei ist erforderlich'; end if;
 if d.reviewer_user_id is null or d.approver_user_id is null then raise exception 'Prüfer und Freigeber müssen zugewiesen sein'; end if;
 if d.creator_user_id=d.reviewer_user_id or d.creator_user_id=d.approver_user_id or d.reviewer_user_id=d.approver_user_id then raise exception 'Ersteller, Prüfer und Freigeber müssen getrennte Personen sein'; end if;
 rr:=public.dms_role_of(d.organization_id,d.reviewer_user_id); ar:=public.dms_role_of(d.organization_id,d.approver_user_id);
 if rr not in ('owner','admin','pruefer') then raise exception 'Zugewiesener Prüfer hat keine Prüferrolle'; end if;
 if ar not in ('owner','admin','freigeber') then raise exception 'Zugewiesener Freigeber hat keine Freigeberrolle'; end if;
 update public.documents set status='in_review' where id=d.id returning * into d;
 insert into public.document_events(document_id,actor_user_id,event_type,from_status,to_status,comment) values(d.id,auth.uid(),'submitted',old_status,'in_review',coalesce(note,''));
 return d;
end; $$;

create or replace function public.review_document(target_document uuid,decision text,note text default '')
returns public.documents language plpgsql security definer set search_path=public as $$
declare d public.documents; ns text;
begin
 select * into d from public.documents where id=target_document for update;
 if d.status<>'in_review' then raise exception 'Dokument ist nicht in Prüfung'; end if;
 if auth.uid()<>d.reviewer_user_id and not public.has_org_role(d.organization_id,array['owner','admin']) then raise exception 'Nur der zugewiesene Prüfer darf entscheiden'; end if;
 ns:=case when decision='approve' then 'awaiting_approval' when decision='reject' then 'changes_requested' else null end;
 if ns is null then raise exception 'Ungültige Entscheidung'; end if;
 update public.documents set status=ns where id=d.id returning * into d;
 insert into public.document_events(document_id,actor_user_id,event_type,from_status,to_status,comment) values(d.id,auth.uid(),case when decision='approve' then 'review_approved' else 'review_rejected' end,'in_review',ns,coalesce(note,''));
 return d;
end; $$;

create or replace function public.approve_document(target_document uuid,decision text,note text default '')
returns public.documents language plpgsql security definer set search_path=public as $$
declare d public.documents; ns text;
begin
 select * into d from public.documents where id=target_document for update;
 if d.status<>'awaiting_approval' then raise exception 'Dokument wartet nicht auf Freigabe'; end if;
 if auth.uid()<>d.approver_user_id and not public.has_org_role(d.organization_id,array['owner','admin']) then raise exception 'Nur der zugewiesene Freigeber darf entscheiden'; end if;
 ns:=case when decision='approve' then 'approved' when decision='reject' then 'changes_requested' else null end;
 if ns is null then raise exception 'Ungültige Entscheidung'; end if;
 update public.documents set status=ns,approved_at=case when decision='approve' then now() else null end where id=d.id returning * into d;
 if decision='approve' then update public.document_versions set immutable=true where document_id=d.id and version_number=d.current_version; end if;
 insert into public.document_events(document_id,actor_user_id,event_type,from_status,to_status,comment) values(d.id,auth.uid(),case when decision='approve' then 'approved' else 'approval_rejected' end,'awaiting_approval',ns,coalesce(note,''));
 return d;
end; $$;

create or replace function public.start_document_revision(target_document uuid,new_revision text,note text default '')
returns public.documents language plpgsql security definer set search_path=public as $$
declare d public.documents;
begin
 select * into d from public.documents where id=target_document for update;
 if d.status<>'approved' then raise exception 'Nur freigegebene Dokumente können revidiert werden'; end if;
 if not public.has_org_role(d.organization_id,array['owner','admin','ersteller']) then raise exception 'Keine Berechtigung'; end if;
 update public.documents set status='draft',revision_label=new_revision,current_file_path='',current_file_name='',current_mime_type='',approved_at=null where id=d.id returning * into d;
 insert into public.document_events(document_id,actor_user_id,event_type,from_status,to_status,comment,metadata) values(d.id,auth.uid(),'revision_started','approved','draft',coalesce(note,''),jsonb_build_object('revision',new_revision));
 return d;
end; $$;

create or replace function public.mark_document_obsolete(target_document uuid,note text default '')
returns public.documents language plpgsql security definer set search_path=public as $$
declare d public.documents;
begin
 select * into d from public.documents where id=target_document for update;
 if d.status<>'approved' then raise exception 'Nur freigegebene Dokumente können ungültig gesetzt werden'; end if;
 if not public.has_org_role(d.organization_id,array['owner','admin','freigeber']) then raise exception 'Keine Berechtigung'; end if;
 update public.documents set status='obsolete',obsolete_at=now() where id=d.id returning * into d;
 insert into public.document_events(document_id,actor_user_id,event_type,from_status,to_status,comment) values(d.id,auth.uid(),'obsolete','approved','obsolete',coalesce(note,''));
 return d;
end; $$;

grant execute on function public.submit_document(uuid,text) to authenticated;
grant execute on function public.review_document(uuid,text,text) to authenticated;
grant execute on function public.approve_document(uuid,text,text) to authenticated;
grant execute on function public.start_document_revision(uuid,text,text) to authenticated;
grant execute on function public.mark_document_obsolete(uuid,text) to authenticated;

insert into storage.buckets(id,name,public) values('documents','documents',false) on conflict(id) do update set public=false;
drop policy if exists dms_storage_select on storage.objects;
create policy dms_storage_select on storage.objects for select to authenticated using(bucket_id='documents' and public.is_org_member(((storage.foldername(name))[1])::uuid));
drop policy if exists dms_storage_insert on storage.objects;
create policy dms_storage_insert on storage.objects for insert to authenticated with check(bucket_id='documents' and public.has_org_role(((storage.foldername(name))[1])::uuid,array['owner','admin','ersteller']));
