import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectDatabase, sequelize } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseDir = path.resolve(__dirname, '../../database');

const sqlScripts = [
  'update_client_balance.sql',
  'update_global_balance.sql',
];

async function ejecutarScriptsSql() {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  try {
    for (const scriptName of sqlScripts) {
      const scriptPath = path.join(databaseDir, scriptName);
      const sql = await fs.readFile(scriptPath, 'utf8');
      await client.query(sql);
      console.log(`Script ejecutado correctamente: ${scriptName}`);
    }
  } finally {
    await client.end();
  }
}

async function sincronizarBaseDeDatos() {
  try {
    await connectDatabase();
    await sequelize.sync({ alter: true });
    console.log('¡Base de datos sincronizada correctamente!');
    await ejecutarScriptsSql();
    console.log('¡Triggers de saldo sincronizados correctamente!');
  } catch (error) {
    console.error('Error al sincronizar la base de datos:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

sincronizarBaseDeDatos();
