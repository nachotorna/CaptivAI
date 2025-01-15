const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI; // Define tu URI de MongoDB en el archivo .env
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log('Conexión exitosa a MongoDB');
        return client.db('nombreDeTuBaseDeDatos'); // Cambia esto al nombre de tu base de datos
    } catch (error) {
        console.error('Error al conectar con MongoDB:', error);
        process.exit(1);
    }
}

module.exports = connectDB;
