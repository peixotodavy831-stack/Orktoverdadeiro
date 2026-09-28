import { spawnSync } from 'node:child_process';

function envName(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function getPostgresConnection() {
  const explicitHost = envName('PGHOST');
  const connectionUrl = envName('ORKTO_DATABASE_URL', 'DATABASE_URL');
  let connection;

  if (explicitHost) {
    connection = {
      host: explicitHost,
      port: envName('PGPORT') || '5432',
      user: envName('PGUSER') || envName('USER', 'USERNAME') || 'postgres',
      database: envName('PGDATABASE') || 'postgres',
      password: envName('PGPASSWORD'),
      sslmode: envName('PGSSLMODE'),
    };
  } else if (connectionUrl) {
    const parsed = new URL(connectionUrl);
    connection = {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: decodeURIComponent(parsed.username || 'postgres'),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'postgres'),
      password: decodeURIComponent(parsed.password || ''),
      sslmode: parsed.searchParams.get('sslmode') || envName('PGSSLMODE'),
    };
  } else {
    throw new Error('Configure PGHOST/PGPORT/PGUSER/PGDATABASE or ORKTO_DATABASE_URL/DATABASE_URL.');
  }

  if (!connection.host || !connection.database || !connection.user) {
    throw new Error('PostgreSQL connection host, database, and user are required.');
  }

  return connection;
}

export function isLoopbackHost(host) {
  const normalized = String(host).trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1';
}

export function assertMigrationTargetAllowed(target, connection) {
  if (!['ci', 'local', 'staging'].includes(target)) {
    throw new Error('Migration target must be one of: ci, local, staging.');
  }

  if (target === 'ci' || target === 'local') {
    if (!isLoopbackHost(connection.host)) {
      throw new Error(`Refusing ${target} migration replay against non-local host '${connection.host}'.`);
    }
    return;
  }

  const acknowledgment = process.env.ORKTO_ENABLE_DISPOSABLE_STAGING_REPLAY;
  const expectedHost = process.env.ORKTO_EXPECTED_STAGING_DB_HOST;
  if (acknowledgment !== 'I_ACKNOWLEDGE_THIS_DISPOSABLE_STAGING_DATABASE_WILL_BE_MUTATED') {
    throw new Error('Staging replay is disabled unless ORKTO_ENABLE_DISPOSABLE_STAGING_REPLAY is explicitly acknowledged.');
  }
  if (!expectedHost || expectedHost.toLowerCase() !== connection.host.toLowerCase()) {
    throw new Error('Staging replay requires ORKTO_EXPECTED_STAGING_DB_HOST to exactly match the connected host.');
  }
  if (isLoopbackHost(connection.host)) {
    throw new Error('The staging target must be a non-local, explicitly confirmed disposable PostgreSQL host.');
  }
  if (connection.host.includes('qneqljlphgkptebsaonb')) {
    throw new Error('Refusing to run the fixture replay against the known production project host.');
  }
}

export function psqlExecutable() {
  return process.env.ORKTO_PSQL_BIN || 'psql';
}

export function psqlEnvironment(connection) {
  const env = { ...process.env };
  env.PGHOST = connection.host;
  env.PGPORT = String(connection.port);
  env.PGUSER = connection.user;
  env.PGDATABASE = connection.database;
  env.PGAPPNAME = env.PGAPPNAME || 'orkto-production-readiness';
  delete env.PGSERVICE;
  delete env.PGSERVICEFILE;
  delete env.PGOPTIONS;
  if (connection.password !== undefined) env.PGPASSWORD = connection.password;
  if (connection.sslmode) env.PGSSLMODE = connection.sslmode;
  return env;
}

export function invokePsql({ args, connection, label, cwd, maxBuffer = 32 * 1024 * 1024 }) {
  const executable = psqlExecutable();
  const result = spawnSync(executable, [
    '-X',
    '-w',
    '--host', connection.host,
    '--port', String(connection.port),
    '--username', connection.user,
    '--dbname', connection.database,
    '--set', 'ON_ERROR_STOP=1',
    ...args,
  ], {
    cwd,
    env: psqlEnvironment(connection),
    encoding: 'utf8',
    maxBuffer,
    windowsHide: true,
  });

  const secret = connection.password;
  const redact = (value) => {
    let output = String(value || '');
    if (secret) output = output.split(secret).join('[REDACTED]');
    return output;
  };

  if (result.error) {
    const error = new Error(`${label}: ${redact(result.error.message)}`);
    error.code = result.error.code;
    error.stdout = redact(result.stdout);
    error.stderr = redact(result.stderr);
    throw error;
  }
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].map(redact).filter(Boolean).join('\n');
    const error = new Error(`${label} failed with exit code ${result.status}${details ? `:\n${details}` : '.'}`);
    error.code = result.status;
    error.stdout = redact(result.stdout);
    error.stderr = redact(result.stderr);
    throw error;
  }

  return {
    stdout: redact(result.stdout),
    stderr: redact(result.stderr),
    status: result.status,
  };
}
