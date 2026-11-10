import { connectDatabase, sequelize } from './database.js';

async function sincronizarBaseDeDatos() {
  try {
    await connectDatabase();
    await sequelize.sync({ alter: true });
    console.log('¡Base de datos sincronizada correctamente!');
  } catch (error) {
    console.error('Error al sincronizar la base de datos:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

sincronizarBaseDeDatos();
