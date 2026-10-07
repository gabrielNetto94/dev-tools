const express = require('express');
const cors = require('cors');
const { Pool, Client } = require('pg');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do PostgreSQL de Destino (onde os clones são criados)
const TARGET_HOST = process.env.TARGET_PG_HOST || 'postgres';
const TARGET_PORT = parseInt(process.env.TARGET_PG_PORT || '5432', 10);
const TARGET_USER = process.env.TARGET_PG_USER || 'postgres';
const TARGET_PASSWORD = process.env.TARGET_PG_PASSWORD || 'postgres';
const TARGET_MAINTENANCE_DB = process.env.TARGET_PG_DATABASE || 'postgres';
const HOST_PORT = process.env.HOST_PORT || '5432';

// Configurações do Servidor de Origem padrão (de onde listamos os bancos para clonar)
const DEFAULT_SOURCE_HOST = process.env.SOURCE_PG_HOST || 'host.docker.internal';
const DEFAULT_SOURCE_PORT = parseInt(process.env.SOURCE_PG_PORT || '5432', 10);
const DEFAULT_SOURCE_USER = process.env.SOURCE_PG_USER || 'postgres';
const DEFAULT_SOURCE_PASSWORD = process.env.SOURCE_PG_PASSWORD || 'postgres';

// Pool de conexões para o Postgres de destino
const targetPool = new Pool({
  host: TARGET_HOST,
  port: TARGET_PORT,
  user: TARGET_USER,
  password: TARGET_PASSWORD,
  database: TARGET_MAINTENANCE_DB,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Módulo DynamoDB Workbench
const dynamodbRouter = require('./dynamodb');
app.use('/api/dynamodb', dynamodbRouter);

// Retorna URL de conexão do Postgres de destino (rede interna do Docker)
function getTargetDbUrl(dbName) {
  return `postgresql://${TARGET_USER}:${encodeURIComponent(TARGET_PASSWORD)}@${TARGET_HOST}:${TARGET_PORT}/${dbName}`;
}

// Retorna URL de conexão que o usuário final usará a partir de seu host
function getClientDbUrl(dbName) {
  return `postgresql://${TARGET_USER}:${encodeURIComponent(TARGET_PASSWORD)}@localhost:${HOST_PORT}/${dbName}`;
}

// Endpoint de info do sistema e destino
app.get('/api/info', async (req, res) => {
  try {
    const result = await targetPool.query('SELECT version();');
    res.json({
      status: 'online',
      targetHost: TARGET_HOST,
      hostPort: HOST_PORT,
      pgVersion: result.rows[0].version,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Não foi possível conectar ao PostgreSQL de destino: ' + err.message,
    });
  }
});

// Endpoint para retornar configurações padrão do servidor de origem
app.get('/api/source/config', (req, res) => {
  res.json({
    host: DEFAULT_SOURCE_HOST,
    port: DEFAULT_SOURCE_PORT,
    user: DEFAULT_SOURCE_USER,
    hasPassword: !!DEFAULT_SOURCE_PASSWORD,
  });
});

// Listar todos os bancos disponíveis no Servidor de Origem para seleção
app.post('/api/source/databases', async (req, res) => {
  const host = (req.body.host || DEFAULT_SOURCE_HOST).trim();
  const port = parseInt(req.body.port || DEFAULT_SOURCE_PORT, 10);
  const user = (req.body.user || DEFAULT_SOURCE_USER).trim();
  const password = req.body.password !== undefined ? req.body.password : DEFAULT_SOURCE_PASSWORD;

  const client = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres', // Conecta ao banco de manutenção para ler pg_database
    connectionTimeoutMillis: 6000,
  });

  try {
    await client.connect();
    const query = `
      SELECT 
        datname AS name,
        pg_size_pretty(pg_database_size(datname)) AS size_pretty,
        pg_database_size(datname) AS size_bytes
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname ASC;
    `;
    const result = await client.query(query);
    await client.end();

    res.json({
      success: true,
      server: { host, port, user },
      databases: result.rows,
    });
  } catch (err) {
    try { await client.end(); } catch (_) {}
    res.status(400).json({
      success: false,
      error: `Não foi possível conectar ao servidor ${host}:${port}: ${err.message}`,
    });
  }
});

// Resolver configuração de conexão com o PostgreSQL de destino
function resolveTargetServerConfig(params = {}) {
  const mode = (params.targetServerMode || 'local').trim();

  if (mode === 'source') {
    const host = (params.sourceHost || DEFAULT_SOURCE_HOST).trim();
    const port = parseInt(params.sourcePort || DEFAULT_SOURCE_PORT, 10);
    const user = (params.sourceUser || DEFAULT_SOURCE_USER).trim();
    const password = params.sourcePassword !== undefined ? params.sourcePassword : DEFAULT_SOURCE_PASSWORD;

    return {
      mode: 'source',
      host,
      port,
      user,
      password,
      database: 'postgres',
      clientHost: host === 'postgres' ? 'localhost' : host,
      clientPort: port,
    };
  }

  if (mode === 'custom') {
    const host = (params.targetHost || DEFAULT_SOURCE_HOST).trim();
    const port = parseInt(params.targetPort || DEFAULT_SOURCE_PORT, 10);
    const user = (params.targetUser || DEFAULT_SOURCE_USER).trim();
    const password = params.targetPassword !== undefined ? params.targetPassword : DEFAULT_SOURCE_PASSWORD;

    return {
      mode: 'custom',
      host,
      port,
      user,
      password,
      database: 'postgres',
      clientHost: host === 'postgres' ? 'localhost' : host,
      clientPort: port,
    };
  }

  // Padrão: Local (container cloner_postgres)
  return {
    mode: 'local',
    host: TARGET_HOST,
    port: TARGET_PORT,
    user: TARGET_USER,
    password: TARGET_PASSWORD,
    database: TARGET_MAINTENANCE_DB,
    clientHost: 'localhost',
    clientPort: HOST_PORT,
  };
}

function formatDbUrl(config, dbName) {
  return `postgresql://${config.user}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${dbName}`;
}

function formatClientUrl(config, dbName) {
  return `postgresql://${config.user}:${encodeURIComponent(config.password)}@${config.clientHost}:${config.clientPort}/${dbName}`;
}

// Listar todos os bancos disponíveis no Servidor de Destino (para poder selecionar e sobrescrever)
app.post('/api/target/databases', async (req, res) => {
  const targetConfig = resolveTargetServerConfig(req.body);

  const client = new Client({
    host: targetConfig.host,
    port: targetConfig.port,
    user: targetConfig.user,
    password: targetConfig.password,
    database: targetConfig.database,
    connectionTimeoutMillis: 6000,
  });

  try {
    await client.connect();
    const query = `
      SELECT 
        datname AS name,
        pg_size_pretty(pg_database_size(datname)) AS size_pretty,
        pg_database_size(datname) AS size_bytes
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname ASC;
    `;
    const result = await client.query(query);
    await client.end();

    res.json({
      success: true,
      server: {
        mode: targetConfig.mode,
        host: targetConfig.host,
        port: targetConfig.port,
        user: targetConfig.user,
      },
      databases: result.rows,
    });
  } catch (err) {
    try { await client.end(); } catch (_) {}
    res.status(400).json({
      success: false,
      error: `Não foi possível conectar ao servidor de destino ${targetConfig.host}:${targetConfig.port}: ${err.message}`,
    });
  }
});

// Testar conexão detalhada com um banco específico de origem
app.post('/api/test-connection', async (req, res) => {
  let { url, host, port, user, password, database } = req.body;

  let connectionConfig = {};
  if (url && typeof url === 'string') {
    connectionConfig = { connectionString: url.trim() };
  } else {
    connectionConfig = {
      host: (host || DEFAULT_SOURCE_HOST).trim(),
      port: parseInt(port || DEFAULT_SOURCE_PORT, 10),
      user: (user || DEFAULT_SOURCE_USER).trim(),
      password: password !== undefined ? password : DEFAULT_SOURCE_PASSWORD,
      database: (database || 'postgres').trim(),
    };
  }
  connectionConfig.connectionTimeoutMillis = 6000;

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    const query = `
      SELECT 
        current_database() AS dbname,
        current_user AS dbuser,
        version() AS version,
        pg_size_pretty(pg_database_size(current_database())) AS size,
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) AS tables_count
    `;
    const result = await client.query(query);
    await client.end();

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    try { await client.end(); } catch (_) {}
    res.json({
      success: false,
      error: err.message,
    });
  }
});

// Listar todos os clones existentes no Postgres de destino
app.get('/api/clones', async (req, res) => {
  try {
    const query = `
      SELECT 
        datname AS name,
        pg_size_pretty(pg_database_size(datname)) AS size_pretty,
        pg_database_size(datname) AS size_bytes,
        datistemplate AS is_template
      FROM pg_database
      WHERE datistemplate = false AND datname NOT IN ('postgres')
      ORDER BY datname ASC;
    `;
    const result = await targetPool.query(query);

    const clones = result.rows.map(row => ({
      ...row,
      connectionString: getClientDbUrl(row.name),
      psqlCommand: `psql "${getClientDbUrl(row.name)}"`,
    }));

    res.json({ success: true, clones });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Excluir um clone
app.delete('/api/clones/:name', async (req, res) => {
  const { name } = req.params;

  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
    return res.status(400).json({ success: false, error: 'Nome de banco de dados inválido.' });
  }

  if (name === 'postgres') {
    return res.status(400).json({ success: false, error: 'O banco padrão postgres não pode ser excluído.' });
  }

  try {
    // Derrubar conexões ativas no banco antes de excluir
    await targetPool.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [name]);

    await targetPool.query(`DROP DATABASE "${name}";`);

    res.json({ success: true, message: `Banco ${name} excluído com sucesso.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clonagem instantânea local usando TEMPLATE (1 segundo!)
app.post('/api/clones/template', async (req, res) => {
  const { sourceClone, newCloneName } = req.body;

  if (!sourceClone || !newCloneName || !/^[a-zA-Z0-9_]+$/.test(newCloneName)) {
    return res.status(400).json({ success: false, error: 'Nomes inválidos para clonagem via template.' });
  }

  try {
    await targetPool.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = $1 AND pid <> pg_backend_pid();
    `, [sourceClone]);

    const startTime = Date.now();
    await targetPool.query(`CREATE DATABASE "${newCloneName}" TEMPLATE "${sourceClone}";`);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.json({
      success: true,
      message: `Clone ${newCloneName} criado instantaneamente a partir de ${sourceClone} (${duration}s)!`,
      connectionString: getClientDbUrl(newCloneName),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clonagem por streaming com Server-Sent Events (SSE)
app.get('/api/clone-stream', async (req, res) => {
  let { 
    sourceUrl,
    sourceDb,
    sourceHost,
    sourcePort,
    sourceUser,
    sourcePassword,
    cloneName,
    targetDbName,
    targetServerMode,
    targetHost,
    targetPort,
    targetUser,
    targetPassword,
    isExistingDb,
    schemaOnly, 
    dropIfExists 
  } = req.query;

  // Configurar SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const sHost = (sourceHost || DEFAULT_SOURCE_HOST).trim();
  const sPort = parseInt(sourcePort || DEFAULT_SOURCE_PORT, 10);
  const sUser = (sourceUser || DEFAULT_SOURCE_USER).trim();
  const sPass = sourcePassword !== undefined ? sourcePassword : DEFAULT_SOURCE_PASSWORD;

  // Se o usuário selecionou o banco (sourceDb), constrói a URL automaticamente
  const cleanSourceDb = (sourceDb || '').trim();
  if (!sourceUrl && cleanSourceDb) {
    sourceUrl = `postgresql://${sUser}:${encodeURIComponent(sPass)}@${sHost}:${sPort}/${cleanSourceDb}`;
  }

  const chosenDbName = (targetDbName || cloneName || '').trim();

  if (!sourceUrl || !chosenDbName) {
    sendEvent('error', { message: 'Selecione um banco de origem e informe o banco de destino.' });
    return res.end();
  }

  if (!/^[a-zA-Z0-9_]+$/.test(chosenDbName)) {
    sendEvent('error', { message: 'Nome do banco de destino só pode conter letras, números e underline (_).' });
    return res.end();
  }

  const targetConfig = resolveTargetServerConfig(req.query);

  const isSameServer = targetConfig.mode === 'source' || 
    (targetConfig.host === sHost && targetConfig.port === sPort);
  const isExactSameDb = isSameServer && (cleanSourceDb === chosenDbName);

  const startTime = Date.now();
  sendEvent('log', { message: `🚀 Iniciando processo de clonagem para o banco: ${chosenDbName} (Servidor: ${targetConfig.mode})...` });

  // 1. Conectar e preparar o banco no servidor de destino
  const targetClient = new Client({
    host: targetConfig.host,
    port: targetConfig.port,
    user: targetConfig.user,
    password: targetConfig.password,
    database: targetConfig.database,
    connectionTimeoutMillis: 6000,
  });

  try {
    await targetClient.connect();
    sendEvent('log', { message: `✓ Conectado ao servidor PostgreSQL de destino (${targetConfig.host}:${targetConfig.port}).` });

    if (isExactSameDb) {
      sendEvent('log', { message: `ℹ️ O banco de destino é o próprio banco de origem '${chosenDbName}'. O streaming aplicará restauração com limpeza (--clean).` });
    } else {
      // Verificar se já existe no destino
      const checkRes = await targetClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [chosenDbName]
      );

      if (checkRes.rows.length > 0) {
        if (dropIfExists === 'true' || isExistingDb === 'true') {
          sendEvent('log', { message: `⚠️ Banco '${chosenDbName}' já existia no destino. Derrubando conexões e recriando...` });
          await targetClient.query(`
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = $1 AND pid <> pg_backend_pid();
          `, [chosenDbName]);
          await targetClient.query(`DROP DATABASE "${chosenDbName}";`);
          sendEvent('log', { message: `📁 Criando novo banco de dados '${chosenDbName}'...` });
          await targetClient.query(`CREATE DATABASE "${chosenDbName}";`);
        } else {
          throw new Error(`Um banco com o nome '${chosenDbName}' já existe no destino. Marque a opção de sobrescrever ou escolha outro nome.`);
        }
      } else {
        sendEvent('log', { message: `📁 Criando novo banco de dados '${chosenDbName}'...` });
        await targetClient.query(`CREATE DATABASE "${chosenDbName}";`);
      }
      sendEvent('log', { message: `✓ Banco '${chosenDbName}' pronto no destino. Iniciando stream de dados...` });
    }
  } catch (err) {
    try { await targetClient.end(); } catch (_) {}
    sendEvent('error', { message: 'Falha na preparação do banco de destino: ' + err.message });
    return res.end();
  } finally {
    try { await targetClient.end(); } catch (_) {}
  }

  // 2. Executar streaming: pg_dump | pg_restore
  const targetDbUrl = formatDbUrl(targetConfig, chosenDbName);
  const clientUrl = formatClientUrl(targetConfig, chosenDbName);

  const dumpArgs = [
    `--dbname=${sourceUrl.trim()}`,
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--verbose',
  ];
  if (schemaOnly === 'true') {
    dumpArgs.push('--schema-only');
    sendEvent('log', { message: 'ℹ️ Modo: Apenas Esquema (sem dados de tabelas).' });
  } else {
    sendEvent('log', { message: 'ℹ️ Modo: Clonagem Completa (Esquema + Dados).' });
  }

  const restoreArgs = [
    `--dbname=${targetDbUrl}`,
    '--no-owner',
    '--no-privileges',
    '--verbose',
  ];
  if (isExactSameDb) {
    restoreArgs.push('--clean', '--if-exists');
  } else {
    restoreArgs.push('--exit-on-error');
  }

  sendEvent('log', { message: '⚡ Conectando pipe de streaming na memória (pg_dump | pg_restore)...' });

  const dumpProcess = spawn('pg_dump', dumpArgs);
  const restoreProcess = spawn('pg_restore', restoreArgs);

  // Pipe stdout do dump direto no stdin do restore
  dumpProcess.stdout.pipe(restoreProcess.stdin);

  dumpProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      sendEvent('log', { message: `[pg_dump] ${text}` });
    }
  });

  restoreProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      sendEvent('log', { message: `[pg_restore] ${text}` });
    }
  });

  let hasError = false;

  dumpProcess.on('error', (err) => {
    hasError = true;
    sendEvent('error', { message: `Erro no processo pg_dump: ${err.message}` });
  });

  restoreProcess.on('error', (err) => {
    hasError = true;
    sendEvent('error', { message: `Erro no processo pg_restore: ${err.message}` });
  });

  restoreProcess.on('close', async (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (code === 0 && !hasError) {
      sendEvent('log', { message: `🎉 Clonagem concluída com sucesso em ${duration}s!` });
      sendEvent('success', {
        cloneName: chosenDbName,
        duration: duration,
        connectionString: clientUrl,
        psqlCommand: `psql "${clientUrl}"`,
        targetServer: targetConfig.mode,
      });
    } else {
      sendEvent('error', {
        message: `A clonagem falhou com código de saída ${code}. Veja os logs acima para detalhes.`,
      });
    }
    res.end();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Postgres Cloner rodando na porta ${PORT}`);
  console.log(`Conectado ao Postgres de destino em ${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`Servidor de origem padrão em ${DEFAULT_SOURCE_HOST}:${DEFAULT_SOURCE_PORT}`);
});
