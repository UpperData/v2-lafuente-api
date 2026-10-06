import 'dotenv/config';
import express from 'express';
import { connectDatabase, sequelize } from './config/database.js';
import routes from './routes/index.js';

const app = express();
const port = Number(process.env.APP_PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('APP_PORT debe ser un puerto válido entre 1 y 65535.');
}

app.use(express.json());
app.use('/api', routes);
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

try {
  await connectDatabase();
  const server = app.listen(port, () => {
    console.log(`API escuchando en el puerto ${port}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await sequelize.close();
      process.exitCode = 0;
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  console.error('No se pudo conectar a PostgreSQL:', error.message);
  await sequelize.close();
  process.exitCode = 1;
}