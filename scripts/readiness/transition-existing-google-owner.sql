-- Operator-only, one-account transition. NOT a migration or a public RPC.
-- Run only after explicit owner approval, in ghrjongiodziasupakrk SQL Editor.
-- Required transaction-local settings: orkto.owner_transition_target_ref,
-- orkto.owner_transition_email_sha256, orkto.owner_transition_approval.
-- Existing profile/workspace/data/roles are not created, replaced or deleted.
do $$
declare
  v_digest text := current_setting('orkto.owner_transition_email_sha256',true);
  v_user auth.users%rowtype;
  v_admission orkto_pilot_private.admissions%rowtype;
  v_admission_id uuid;
begin
  if current_user<>'postgres'
    or coalesce(current_setting('orkto.owner_transition_target_ref',true),'')<>'ghrjongiodziasupakrk'
    or coalesce(current_setting('orkto.owner_transition_approval',true),'')<>'OWNER_APPROVED_GOOGLE_ONLY_30_DAYS'
    or coalesce(v_digest,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'OWNER_TRANSITION_APPROVAL_AND_STAGING_TARGET_REQUIRED';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations)<>44
    or (select count(*) from supabase_migrations.schema_migrations where name='google_pilot_gate_fails_closed')<>1
    or not orkto_pilot_private.is_enabled() then
    raise exception 'OWNER_TRANSITION_SCHEMA_OR_GATE_MISMATCH';
  end if;
  select * into strict v_user from auth.users u
    where encode(sha256(convert_to(lower(btrim(u.email)),'UTF8')),'hex')=v_digest for update;
  if (select count(*) from public.profiles where id=v_user.id)<>1
    or (select count(*) from public.orkto_workspace_members where user_id=v_user.id and status='active')<>1
    or not exists(select 1 from public.orkto_workspace_members m
      join public.orkto_workspaces w on w.id=m.workspace_id
      where m.user_id=v_user.id and m.status='active' and m.role='owner'
        and w.id=v_user.id and w.owner_user_id=v_user.id) then
    raise exception 'OWNER_TRANSITION_EXISTING_OWNERSHIP_MISMATCH';
  end if;
  select * into v_admission from orkto_pilot_private.admissions
    where email_sha256=v_digest or user_id=v_user.id for update;
  if found then
    if v_admission.email_sha256=v_digest and v_admission.user_id=v_user.id
      and v_admission.active and v_admission.expires_at>now()
      and v_admission.member_role='owner' and v_admission.create_workspace
      and v_admission.workspace_id is null and coalesce(v_user.encrypted_password,'')='' then
      raise notice 'OWNER_GOOGLE_TRANSITION_ALREADY_PREPARED';
      return;
    end if;
    raise exception 'OWNER_TRANSITION_EXISTING_ADMISSION_REVIEW_REQUIRED';
  end if;
  if coalesce(v_user.encrypted_password,'')=''
    or exists(select 1 from auth.identities where user_id=v_user.id and provider<>'email')
    or exists(select 1 from auth.sessions where user_id=v_user.id)
    or exists(select 1 from auth.refresh_tokens where user_id=v_user.id::text) then
    raise exception 'OWNER_TRANSITION_AUTH_STATE_CHANGED';
  end if;
  -- The owner provisioning mode describes the original owner workspace, whose
  -- id and ownership were verified above. No profile INSERT occurs here, so
  -- its workspace-provisioning trigger is never invoked by this transition.
  insert into orkto_pilot_private.admissions
    (email_sha256,user_id,create_workspace,member_role,expires_at,approved_by)
  values(v_digest,v_user.id,true,'owner',now()+interval '30 days','OWNER_EXPLICIT_GOOGLE_ONLY_TRANSITION')
  returning id into v_admission_id;
  -- Keep the Auth user and existing email identity. Supabase, not this script,
  -- must verify Google and bind its provider subject on the next OAuth login.
  update auth.users set encrypted_password='' where id=v_user.id;
  insert into orkto_pilot_private.audit(admission_id,actor,action)
    values(v_admission_id,'OWNER_EXPLICIT_GOOGLE_ONLY_TRANSITION','LEGACY_PASSWORD_DISABLED');
  raise notice 'OWNER_GOOGLE_TRANSITION_PREPARED';
end $$;
