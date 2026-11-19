import sql from 'mssql';

function parseSqlServerUrl(databaseUrl: string) {
  const withoutPrefix = databaseUrl.replace(/^sqlserver:\/\//i, '');
  const [hostPort, ...paramParts] = withoutPrefix.split(';');
  const [server, portStr] = hostPort.split(':');
  const params = new Map<string, string>();
  for (const part of paramParts) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const val = part.slice(eqIdx + 1).trim();
    params.set(key, val);
  }
  return {
    server,
    port: portStr ? Number(portStr) : 1433,
    database: params.get('database') || 'pmam',
    user: params.get('user') || params.get('username') || 'sa',
    password: params.get('password') || '',
    encrypt: params.get('encrypt') !== 'false',
    trustServerCertificate: params.get('trustservercertificate') !== 'false',
  };
}

/**
 * Connects to MSSQL master database and creates the target database if it does not exist.
 */
export async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const parsed = parseSqlServerUrl(databaseUrl);
  const safeDbName = parsed.database.replace(/\]/g, '');

  const pool = await sql.connect({
    server: parsed.server,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: 'master',
    options: {
      encrypt: parsed.encrypt,
      trustServerCertificate: parsed.trustServerCertificate,
    },
  });

  try {
    await pool.request().query(`
      IF DB_ID(N'${safeDbName}') IS NULL
      BEGIN
        CREATE DATABASE [${safeDbName}];
      END
    `);
  } finally {
    await pool.close();
  }
}
