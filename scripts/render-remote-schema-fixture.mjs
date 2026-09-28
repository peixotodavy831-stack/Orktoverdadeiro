// Reconstruct recorded public schema only; never connects to a database.
// auth/storage are local test contracts, not a full Supabase installation.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(path.join(root, 'supabase/reconciled-legacy/remote-schema-2026-09-27.json'), 'utf8'));
const legacy = await readFile(path.join(root, 'supabase/tests/fixtures/legacy_schema.sql'), 'utf8');
const ident = value => '"' + value.replaceAll('"', '""') + '"';
const sql = ['-- Generated from read-only remote metadata; synthetic rows only.', legacy.split('create table if not exists public.profiles')[0],
  `DO $$ BEGIN CREATE ROLE supabase_admin NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`];
sql.push(...snapshot.tableDDL.map(table => table.ddl));
// Primary/unique constraints must exist before foreign keys.
for (const foreign of [false, true]) {
  for (const c of snapshot.constraints.filter(c => c.definition.startsWith('FOREIGN KEY') === foreign)) {
    sql.push(`ALTER TABLE public.${ident(c.table)} ADD CONSTRAINT ${ident(c.name)} ${c.definition};`);
  }
}
for (const index of snapshot.indexes.filter(i => !snapshot.constraints.some(c => c.name === i.name))) sql.push(index.definition + ';');
for (const fn of snapshot.functions) {
  sql.push(fn.definition + ';');
  const signature = `public.${ident(fn.name)}(${fn.identity})`;
  sql.push(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,anon,authenticated;`);
  for (const acl of fn.acl || []) {
    const [role, permission] = acl.split('=');
    if (permission.includes('X')) sql.push(`GRANT EXECUTE ON FUNCTION ${signature} TO ${role ? ident(role) : 'PUBLIC'};`);
  }
}
for (const table of snapshot.tables) if (table.rls) sql.push(`ALTER TABLE public.${ident(table.name)} ENABLE ROW LEVEL SECURITY;`);
for (const p of snapshot.policies) {
  sql.push(`CREATE POLICY ${ident(p.policyname)} ON ${ident(p.schemaname)}.${ident(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(r => r === 'public' ? 'PUBLIC' : ident(r)).join(',')}${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`);
}
for (const g of snapshot.grants) sql.push(`GRANT ${g.privilege_type} ON public.${ident(g.table_name)} TO ${g.grantee === 'PUBLIC' ? 'PUBLIC' : ident(g.grantee)};`);
for (const g of snapshot.columnGrants) sql.push(`GRANT ${g.privilege_type} (${ident(g.column_name)}) ON public.${ident(g.table_name)} TO ${ident(g.grantee)};`);
sql.push(legacy.slice(legacy.indexOf('insert into auth.users')).replace(',asaas_api_key,asaas_customer_id', '').replaceAll(',null,null)', ')'));
// An expired quote and a sent link are realistic historical edge cases. Insert
// before restoring triggers, as a schema-only clone has no original rows.
sql.push(`INSERT INTO public.quotes(user_id,quote_number,client_name,client_phone,items,total,status,sent_at,retention_expires_at)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','EXPIRED-READINESS','Synthetic expired','+550000','[]',10,'expired',now()-interval '30 days',now()-interval '16 days');
INSERT INTO public.proposals(slug,quote_id,user_id,expires_at,is_active)
SELECT 'EXPTEST1',id,user_id,retention_expires_at,false FROM public.quotes WHERE quote_number='EXPIRED-READINESS';`);
sql.push(`INSERT INTO public.clients(user_id,name,phone) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AMBIGUOUS-READINESS-1','+550000'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AMBIGUOUS-READINESS-2','+550000');`);
sql.push(...snapshot.triggers.map(trigger => trigger.definition + ';'));
// Observed Supabase defaults for objects created by postgres. Future migrations
// must explicitly revoke these inherited browser privileges.
for (const owner of ['postgres', 'supabase_admin']) {
  sql.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role,postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role,postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role,postgres;`);
}
await writeFile(process.argv[2], sql.join('\n\n'));
