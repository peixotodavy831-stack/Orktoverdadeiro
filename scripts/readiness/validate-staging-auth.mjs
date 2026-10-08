import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { validateStagingE2EConfig, validateStagingPreviewDeployment } from './staging-e2e-config.mjs';

const ref = 'ghrjongiodziasupakrk';
const url = `https://${ref}.supabase.co`;
const configuredUrl = process.env.ORKTO_STAGING_SUPABASE_URL?.replace(/\/$/, '');
const adminKey = process.env.ORKTO_STAGING_SUPABASE_ADMIN_KEY?.trim();
const publicKey = (process.env.ORKTO_STAGING_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();

if (configuredUrl && configuredUrl !== url) {
  console.error('STAGING_BOUNDARY_FAILED: runner URL is not the approved staging project.');
  process.exit(2);
}
if (!adminKey) {
  console.error('SECURE_STAGING_ADMIN_KEY_REQUIRED: add ORKTO_STAGING_SUPABASE_ADMIN_KEY to the secure staging runner environment.');
  process.exit(2);
}
if (!publicKey) {
  console.error('STAGING_PUBLISHABLE_KEY_REQUIRED: add the staging anon/publishable key to the secure runner environment.');
  process.exit(2);
}

function claimsFor(key) {
  const [header, payload, signature] = key.split('.');
  if (!header || !payload || !signature) return undefined;
  try { return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch { return undefined; }
}

function assertKeyBoundary(key, expectedRole, label) {
  const claims = claimsFor(key);
  if (claims) {
    assert.equal(claims.ref, ref, `${label} key belongs only to the staging project`);
    assert.equal(claims.role, expectedRole, `${label} key has expected Supabase role`);
    return;
  }
  const fingerprintName = expectedRole === 'service_role'
    ? 'ORKTO_STAGING_ADMIN_KEY_SHA256'
    : 'ORKTO_STAGING_PUBLISHABLE_KEY_SHA256';
  const expected = process.env[fingerprintName]?.trim().toLowerCase();
  assert.match(expected || '', /^[a-f0-9]{64}$/, `${fingerprintName} is required for opaque keys`);
  assert.equal(createHash('sha256').update(key).digest('hex'), expected, `${label} key fingerprint matches staging`);
}

assertKeyBoundary(adminKey, 'service_role', 'Admin');
assertKeyBoundary(publicKey, 'anon', 'Publishable');

const admin = createClient(url, adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicProbe = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey } });
assert.equal(publicProbe.status, 200, 'staging publishable key must be accepted by staging Auth');
const { error: adminError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
assert.equal(adminError, null, 'staging Admin API must accept only the project-bound admin key');

const fixtureTag = 'orkto-staging-auth-ab-v03';
const emailFor = (label) => `user-${label.toLowerCase()}@staging.synthetic`;
const freshPassword = () => `${randomBytes(48).toString('base64url')}Aa9!`;
const throwOnError = (label, { error }) => {
  if (error) throw new Error(`${label} failed (${error.code || error.status || 'external error'})`);
};

async function findSyntheticUser(email) {
  for (let page = 1; page < 20; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    throwOnError('Synthetic user lookup', result);
    const found = result.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (found) return found;
    if (result.data.users.length < 1000) return null;
  }
  throw new Error('Synthetic user list exceeded the safe pagination limit.');
}

async function ensureSyntheticUser(label) {
  const email = emailFor(label);
  const password = freshPassword(); // kept only in this process; never printed or persisted
  const current = await findSyntheticUser(email);
  let user;
  if (current) {
    const updated = await admin.auth.admin.updateUserById(current.id, { password, email_confirm: true });
    throwOnError(`Synthetic user ${label} password rotation`, updated);
    user = updated.data.user;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { orkto_fixture: fixtureTag, synthetic: true },
    });
    throwOnError(`Synthetic user ${label} creation`, created);
    user = created.data.user;
  }
  assert.equal(user.email?.toLowerCase(), email);
  assert.equal(user.email_confirmed_at ? true : user.confirmed_at ? true : false, true, 'synthetic email is confirmed');
  return { label, email, userId: user.id, password };
}

async function upsertBy(table, match, row, label) {
  let query = admin.from(table).select('id');
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
  const existing = await query.maybeSingle();
  throwOnError(`${label} lookup`, existing);
  if (existing.data?.id) {
    const updated = await admin.from(table).update(row).eq('id', existing.data.id).select('id').single();
    throwOnError(`${label} update`, updated);
    return updated.data.id;
  }
  const inserted = await admin.from(table).insert(row).select('id').single();
  throwOnError(`${label} insert`, inserted);
  return inserted.data.id;
}

async function ensureWorkspace(user) {
  const profile = await admin.from('profiles').upsert({
    id: user.userId,
    email: user.email,
    display_name: `Staging User ${user.label}`,
    company_name: `Workspace ${user.label} Synthetic`,
    tax_id: `STAGING-SYNTHETIC-${user.label}`,
    onboarding_completed: true,
  }, { onConflict: 'id' });
  throwOnError(`Profile ${user.label}`, profile);

  const workspaceResult = await admin.from('orkto_workspaces')
    .select('id,owner_user_id,name').eq('id', user.userId).single();
  throwOnError(`Workspace ${user.label}`, workspaceResult);
  assert.equal(workspaceResult.data.owner_user_id, user.userId, 'synthetic user owns their workspace');
  const membershipResult = await admin.from('orkto_workspace_members')
    .select('role,status').eq('workspace_id', user.userId).eq('user_id', user.userId).single();
  throwOnError(`Membership ${user.label}`, membershipResult);
  assert.equal(membershipResult.data.role, 'owner');
  assert.equal(membershipResult.data.status, 'active');
  return { workspaceId: workspaceResult.data.id };
}

async function ensureFixture(user) {
  const { workspaceId } = user;
  const suffix = user.label.toLowerCase();
  const phone = suffix === 'a' ? '+5500000000001' : '+5500000000002';
  const email = `customer-${suffix}@staging.synthetic`;
  const clientId = await upsertBy('clients', { workspace_id: workspaceId, phone }, {
    user_id: user.userId, workspace_id: workspaceId,
    name: `Customer ${user.label} Synthetic`, phone,
    company: `Synthetic Fixture ${user.label}`, notes: fixtureTag,
  }, `Client ${user.label}`);
  const serviceId = await upsertBy('services', { workspace_id: workspaceId, name: `Staging Service ${user.label}` }, {
    user_id: user.userId, workspace_id: workspaceId,
    name: `Staging Service ${user.label}`, description: fixtureTag,
    unit_price: 1, category: 'Staging Synthetic',
  }, `Catalog ${user.label}`);
  const contactId = await upsertBy('orkto_contacts', { workspace_id: workspaceId, email }, {
    workspace_id: workspaceId, customer_id: clientId,
    full_name: `Contact ${user.label} Synthetic`, phone, email,
    company: `Synthetic Fixture ${user.label}`, source: 'staging-e2e', created_by: user.userId,
  }, `Contact ${user.label}`);
  const dealId = await upsertBy('orkto_deals', { workspace_id: workspaceId, title: `Staging Deal ${user.label} Synthetic` }, {
    workspace_id: workspaceId, customer_ref: clientId,
    title: `Staging Deal ${user.label} Synthetic`, description: fixtureTag,
    stage: 'qualification', status: 'open', value_cents: 100,
    owner_user_id: user.userId, created_by: user.userId,
    metadata: { fixture: fixtureTag },
  }, `Deal ${user.label}`);
  const quoteNumber = `STAGING-${user.label}-${user.userId.slice(0, 8)}`;
  const quoteId = await upsertBy('quotes', { workspace_id: workspaceId, quote_number: quoteNumber }, {
    user_id: user.userId, workspace_id: workspaceId, customer_id: clientId, deal_id: dealId,
    quote_number: quoteNumber, client_name: `Customer ${user.label} Synthetic`, client_phone: phone,
    client_email: email, notes: fixtureTag,
    items: [{ service_id: serviceId, name: `Staging Service ${user.label}`, quantity: 1, unit_price: 1, total: 1 }],
    subtotal: 1, discount_total: 0, taxes: 0, total: 1, status: 'draft',
  }, `Proposal source ${user.label}`);
  const proposalMatch = { workspace_id: workspaceId, quote_id: quoteId, version: 1 };
  const existingProposal = await admin.from('proposals').select('id').match(proposalMatch).maybeSingle();
  throwOnError(`Proposal ${user.label} lookup`, existingProposal);
  let proposalId = existingProposal.data?.id;
  if (!proposalId) {
    const proposal = await admin.from('proposals').insert({
      workspace_id: workspaceId, quote_id: quoteId, user_id: user.userId,
      slug: `stg${randomBytes(3).toString('hex')}`.slice(0, 8), version: 1, created_by: user.userId,
    }).select('id').single();
    throwOnError(`Proposal ${user.label} insert`, proposal);
    proposalId = proposal.data.id;
  }
  const conversationId = await upsertBy('orkto_conversations', {
    user_id: user.userId, source_channel: 'manual', contact_phone: phone,
  }, {
    user_id: user.userId, workspace_id: workspaceId, contact_name: `Customer ${user.label} Synthetic`,
    contact_phone: phone, source_channel: 'manual', status: 'open',
    customer_id: clientId, deal_id: dealId,
  }, `Conversation ${user.label}`);
  const externalEventId = `${fixtureTag}-${suffix}-message`;
  const message = await admin.from('orkto_messages').select('id').eq('external_event_id', externalEventId).maybeSingle();
  throwOnError(`Message ${user.label} lookup`, message);
  const messageId = message.data?.id || (await admin.from('orkto_messages').insert({
    workspace_id: workspaceId, conversation_id: conversationId,
    sender_role: 'contact', content: `${fixtureTag} message ${user.label}`,
    message_type: 'text', direction: 'incoming', external_event_id: externalEventId,
  }).select('id').single()).data?.id;
  assert.ok(messageId, `Message ${user.label} exists`);

  const traceId = `${fixtureTag}-${suffix}-wia-run`;
  const runId = await upsertBy('orkto_wia_runs', { workspace_id: workspaceId, trace_id: traceId }, {
    workspace_id: workspaceId, user_id: user.userId,
    feature: 'staging-auth-ab-e2e', agent: 'qualification_agent', task_type: 'classification',
    status: 'succeeded', provider: null, model: null, trace_id: traceId,
    context_refs: [{ type: 'customer', id: clientId }, { type: 'deal', id: dealId }],
    summary: `${fixtureTag}: deterministic local-only WIA test context`,
  }, `WIA context ${user.label}`);
  const actionId = await upsertBy('orkto_wia_actions', { workspace_id: workspaceId, idempotency_key: `${fixtureTag}-${suffix}-approval` }, {
    workspace_id: workspaceId, run_id: runId, action_type: 'prepare_followup',
    payload: { conversation_id: conversationId, draft: 'Synthetic approval fixture; never sent externally.' },
    rationale: fixtureTag, risk_level: 'medium', confidence: 1,
    status: 'awaiting_approval', requires_approval: true,
    idempotency_key: `${fixtureTag}-${suffix}-approval`, created_by: user.userId,
  }, `Approval action ${user.label}`);
  const approvalId = await upsertBy('orkto_approval_tasks', { workspace_id: workspaceId, trace_id: `${fixtureTag}-${suffix}-approval` }, {
    workspace_id: workspaceId, conversation_id: conversationId,
    task_type: 'response_suggestion', bot_name: 'WIA',
    proposed_content: 'Synthetic approval fixture; never sent externally.',
    proposed_action: { action_id: actionId }, reason: fixtureTag,
    policy_applied: 'staging-only-no-external-send', status: 'pending',
    trace_id: `${fixtureTag}-${suffix}-approval`,
  }, `Approval ${user.label}`);
  const auditId = await upsertBy('orkto_audit_log', { workspace_id: workspaceId, trace_id: `${fixtureTag}-${suffix}-audit` }, {
    workspace_id: workspaceId, user_id: user.userId, conversation_id: conversationId,
    approval_task_id: approvalId, event_type: 'staging.synthetic.fixture_created',
    actor_type: 'system', actor_id: 'staging-runner', trace_id: `${fixtureTag}-${suffix}-audit`,
    event_data: { fixture: fixtureTag, external_send: false },
  }, `Audit ${user.label}`);

  return {
    workspaceId, clientId, serviceId, contactId, dealId, quoteId, proposalId,
    conversationId, messageId, runId, actionId, approvalId, auditId,
    sentinelId: await upsertBy('clients', { workspace_id: workspaceId, phone: `${phone.slice(0, -1)}9` }, {
      user_id: user.userId, workspace_id: workspaceId,
      name: `Isolation Sentinel ${user.label}`, phone: `${phone.slice(0, -1)}9`,
      company: `Synthetic Fixture ${user.label}`, notes: fixtureTag,
    }, `Isolation sentinel ${user.label}`),
  };
}

async function deniedOrEmpty(result, label) {
  assert.ok(result.error || !result.data?.length, `${label} unexpectedly exposed a row`);
}

async function assertForeignReadsDenied(user, other) {
  const tables = [
    ['clients', other.clientId], ['services', other.serviceId], ['orkto_contacts', other.contactId],
    ['orkto_deals', other.dealId], ['quotes', other.quoteId], ['proposals', other.proposalId],
    ['orkto_conversations', other.conversationId], ['orkto_messages', other.messageId],
    ['orkto_wia_runs', other.runId], ['orkto_wia_actions', other.actionId],
    ['orkto_approval_tasks', other.approvalId], ['orkto_audit_log', other.auditId],
    ['orkto_workspaces', other.workspaceId], ['orkto_workspace_members', other.workspaceId],
  ];
  for (const [table, id] of tables) {
    let request = user.client.from(table).select('*');
    request = table === 'orkto_workspace_members'
      ? request.eq('workspace_id', id).eq('user_id', other.userId)
      : request.eq('id', id);
    await deniedOrEmpty(await request, `Cross-workspace SELECT ${table}`);
  }
}

async function assertDirectWritesDenied(user, other) {
  const foreignWorkspaceId = other.workspaceId;
  const attempts = [
    ['clients', { user_id: user.userId, workspace_id: foreignWorkspaceId, name: 'Spoof customer', phone: `+5599${randomBytes(5).toString('hex')}` }],
    ['services', { user_id: user.userId, workspace_id: foreignWorkspaceId, name: 'Spoof service', unit_price: 1 }],
    ['orkto_contacts', { workspace_id: foreignWorkspaceId, full_name: 'Spoof contact', customer_id: other.clientId }],
    ['orkto_deals', { workspace_id: foreignWorkspaceId, title: 'Spoof deal', customer_ref: other.clientId, owner_user_id: user.userId }],
    ['quotes', { user_id: user.userId, workspace_id: foreignWorkspaceId, quote_number: `SPOOF-${randomBytes(4).toString('hex')}`, client_name: 'Spoof', client_phone: '+5500000000999' }],
    ['orkto_conversations', { user_id: user.userId, workspace_id: foreignWorkspaceId, contact_name: 'Spoof', contact_phone: `+5598${randomBytes(5).toString('hex')}`, source_channel: 'manual' }],
    ['orkto_messages', { workspace_id: foreignWorkspaceId, conversation_id: other.conversationId, sender_role: 'operator', content: 'spoof', direction: 'internal' }],
    ['orkto_approval_tasks', { workspace_id: foreignWorkspaceId, conversation_id: other.conversationId, bot_name: 'WIA', proposed_content: 'spoof', reason: 'spoof', policy_applied: 'spoof' }],
    ['orkto_wia_actions', { workspace_id: foreignWorkspaceId, action_type: 'spoof', idempotency_key: `spoof-${randomBytes(6).toString('hex')}` }],
  ];
  for (const [table, row] of attempts) {
    const result = await user.client.from(table).insert(row).select('id');
    await deniedOrEmpty(result, `Cross-workspace/spoof INSERT ${table}`);
    if (!result.error && result.data?.length) {
      await admin.from(table).delete().eq('id', result.data[0].id);
      assert.fail(`Cross-workspace/spoof INSERT ${table} succeeded; synthetic row was removed.`);
    }
  }
  const original = await admin.from('clients').select('id,name,workspace_id,user_id,phone,company,notes').eq('id', other.sentinelId).single();
  throwOnError('Sentinel baseline', original);
  const update = await user.client.from('clients').update({ name: 'Unauthorized tenant mutation' }).eq('id', other.sentinelId).select('id');
  await deniedOrEmpty(update, 'Cross-workspace UPDATE clients');
  const unchanged = await admin.from('clients').select('name').eq('id', other.sentinelId).single();
  throwOnError('Sentinel after cross-tenant update', unchanged);
  assert.equal(unchanged.data.name, original.data.name);
  const deletion = await user.client.from('clients').delete().eq('id', other.sentinelId).select('id');
  await deniedOrEmpty(deletion, 'Cross-workspace DELETE clients');
  const stillExists = await admin.from('clients').select('id').eq('id', other.sentinelId).single();
  throwOnError('Sentinel after cross-tenant delete', stillExists);
  assert.equal(stillExists.data.id, other.sentinelId);
}

async function assertCompositeRelationsRejectForeignIds(user, other) {
  const label = user.label.toLowerCase();
  const invalidRows = [
    ['orkto_contacts', {
      workspace_id: user.workspaceId, customer_id: other.clientId,
      full_name: `Cross Customer Contact ${label}`, phone: '+5500000000777',
      email: `cross-contact-${label}@staging.synthetic`, source: 'staging-e2e', created_by: user.userId,
    }],
    ['quotes', {
      user_id: user.userId, workspace_id: user.workspaceId, customer_id: other.clientId,
      quote_number: `CROSS-${label}-${randomBytes(3).toString('hex')}`,
      client_name: `Cross ${label}`, client_phone: '+5500000000778',
    }],
    ['orkto_conversations', {
      user_id: user.userId, workspace_id: user.workspaceId, customer_id: other.clientId,
      contact_name: `Cross ${label}`, contact_phone: '+5500000000779', source_channel: 'manual',
    }],
    ['orkto_deals', {
      workspace_id: user.workspaceId, customer_ref: other.clientId,
      title: `Cross-reference ${label} ${randomBytes(3).toString('hex')}`, owner_user_id: user.userId,
    }],
  ];
  for (const [table, row] of invalidRows) {
    const result = await admin.from(table).insert(row).select('id');
    if (!result.error) {
      if (result.data?.length) await admin.from(table).delete().eq('id', result.data[0].id);
      assert.fail(`Database accepted a cross-workspace relation in ${table}; any inserted synthetic row was removed.`);
    }
  }
}

const rawUsers = await Promise.all([ensureSyntheticUser('A'), ensureSyntheticUser('B')]);
const users = await Promise.all(rawUsers.map(async (user) => ({ ...user, ...(await ensureWorkspace(user)) })));
  for (const user of users) Object.assign(user, await ensureFixture(user));

for (const user of users) {
  user.client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await user.client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, `Auth login ${user.label}`);
  assert.ok(login.data.session?.access_token, `Auth session ${user.label}`);
  const current = await user.client.auth.getUser();
  assert.equal(current.error, null, `Auth current session ${user.label}`);
  assert.equal(current.data.user?.id, user.userId, `Auth user identity ${user.label}`);
  const ownClient = await user.client.from('clients').select('id,workspace_id').eq('id', user.clientId).maybeSingle();
  assert.equal(ownClient.error, null, `User ${user.label} own client query`);
  assert.equal(ownClient.data?.id, user.clientId, `User ${user.label} reads own workspace data`);
  const other = users.find((candidate) => candidate.label !== user.label);
  await assertForeignReadsDenied(user, other);
  await assertDirectWritesDenied(user, other);
  await assertCompositeRelationsRejectForeignIds(user, other);
  const { error: signOutError } = await user.client.auth.signOut();
  assert.equal(signOutError, null, `Sign-out ${user.label}`);
  assert.equal((await user.client.auth.getUser()).data.user, null, `Session cleared ${user.label}`);
}

if (process.argv.includes('--browser-e2e')) {
  const previewUrl = process.env.ORKTO_STAGING_PREVIEW_URL?.trim();
  const e2eConfig = validateStagingE2EConfig(process.env);
  assert.equal(e2eConfig.ok, true, `Browser E2E configuration rejected: ${e2eConfig.code}`);
  const parsedPreviewUrl = new URL(previewUrl);
  // Only a hostname vetted above reaches the CLI. Inspect runs before passing
  // synthetic passwords to Playwright and fails closed without exposing them.
  const inspect = spawnSync(process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
    ['inspect', parsedPreviewUrl.hostname, '--format=json'], {
      cwd: process.cwd(), encoding: 'utf8', shell: process.platform === 'win32', timeout: 60_000,
      env: { ...process.env, ORKTO_STAGING_E2E_USER_A_PASSWORD: '', ORKTO_STAGING_E2E_USER_B_PASSWORD: '' },
    });
  assert.equal(inspect.status, 0, 'Authenticated Vercel deployment inspection failed.');
  let deployment;
  try { deployment = JSON.parse(inspect.stdout); }
  catch { throw new Error('Authenticated Vercel deployment inspection returned invalid JSON.'); }
  const scopedList = spawnSync(process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
    ['list', 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc', '--format=json', '--limit', '20'], {
      cwd: process.cwd(), encoding:'utf8', shell:process.platform === 'win32', timeout:60_000,
      env:{ ...process.env, ORKTO_STAGING_E2E_USER_A_PASSWORD:'', ORKTO_STAGING_E2E_USER_B_PASSWORD:'' },
    });
  assert.equal(scopedList.status,0,'Authenticated staging project deployment listing failed.');
  let scopedDeployments;
  try { scopedDeployments = JSON.parse(scopedList.stdout).deployments; }
  catch { throw new Error('Authenticated staging project deployment listing returned invalid JSON.'); }
  const identity = validateStagingPreviewDeployment(previewUrl, deployment, scopedDeployments);
  assert.equal(identity.ok, true, identity.code);

  // The Playwright child receives only the two synthetic users' short-lived
  // passwords and public deployment identity. Admin/public database keys and
  // every other inherited environment value are intentionally withheld.
  const browserEnv = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'PATHEXT']) {
    if (process.env[name]) browserEnv[name] = process.env[name];
  }
  Object.assign(browserEnv, {
    CI: '1',
    ORKTO_STAGING_E2E: '1',
    ORKTO_STAGING_PREVIEW_URL: previewUrl,
    ORKTO_STAGING_VERCEL_PROJECT_ID: 'prj_KZm12jmZIKL3Tqnk2I9DBa9MabKc',
    ORKTO_STAGING_SUPABASE_REF: ref,
    ORKTO_STAGING_E2E_USER_A_EMAIL: rawUsers[0].email,
    ORKTO_STAGING_E2E_USER_A_PASSWORD: rawUsers[0].password,
    ORKTO_STAGING_E2E_USER_B_EMAIL: rawUsers[1].email,
    ORKTO_STAGING_E2E_USER_B_PASSWORD: rawUsers[1].password,
  });
  const playwrightCli = resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js');
  const browserRun = spawnSync(process.execPath, [playwrightCli, 'test', '--config=playwright.config.ts', 'tests/e2e/staging.spec.ts'], {
    cwd: process.cwd(), env: browserEnv, stdio: 'inherit', timeout: 15 * 60 * 1000,
  });
  if (browserRun.error) throw new Error(`Playwright staging E2E could not start (${browserRun.error.code || 'runner error'}).`);
  assert.equal(browserRun.signal, null, 'Playwright staging E2E was terminated unexpectedly.');
  assert.equal(browserRun.status, 0, 'Playwright staging E2E failed. Review only sanitized test output; credentials are never printed.');
}

console.log(process.argv.includes('--browser-e2e')
  ? 'PASS: staging Auth/session A+B, synthetic fixtures, tenant isolation, logout, and staging browser E2E.'
  : 'PASS: staging Auth/session A+B, synthetic workspace/customer/contact/deal/catalog/proposal/conversation/message/WIA/action/approval/audit fixtures; foreign SELECT and direct cross-tenant writes denied; composite foreign IDs rejected; logout clears each session.');
