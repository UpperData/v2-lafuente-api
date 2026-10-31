// sync.js
import connectDatabase from './database.js'; // Ajusta la ruta y añade la extensión 
import '../models/index.js'; // Asegúrate de importar tus modelos para que Sequelize los reconozca

async function sincronizarBaseDeDatos() {
  try {
    // Puedes usar { force: true } o { alter: true } según lo que necesites
    await connectDatabase.sync({ alter: true }); 
    console.log('¡Base de datos sincronizada correctamente!');
    process.exit(0); // Cierra el proceso con éxito
  } catch (error) {
    console.error('Error al sincronizar la base de datos:', error);
    process.exit(1); // Cierra el proceso con error
  }
}

sincronizarBaseDeDatos();
