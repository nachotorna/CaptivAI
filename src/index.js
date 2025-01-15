require('dotenv').config();
console.log('Clave de API:', process.env.PAGESPEED_API_KEY);

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Ruta raíz para verificar que el servidor esté funcionando
app.get('/', (req, res) => res.send('Servidor funcionando correctamente'));

// Endpoint para analizar URLs
app.post('/api/analyze', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL es requerida' });
    }

    try {
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}`;
        const response = await axios.get(apiUrl);

        // Extraer datos importantes
        const { lighthouseResult } = response.data;

        const filteredData = {
            url: response.data.id || 'No disponible',
            performanceScore: lighthouseResult?.categories?.performance?.score * 100 || 0, // Puntuación general
            metrics: {
                firstContentfulPaint: lighthouseResult?.audits?.['first-contentful-paint']?.displayValue || 'No disponible',
                largestContentfulPaint: lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue || 'No disponible',
                speedIndex: lighthouseResult?.audits?.['speed-index']?.displayValue || 'No disponible',
                totalBlockingTime: lighthouseResult?.audits?.['total-blocking-time']?.displayValue || 'No disponible',
                cumulativeLayoutShift: lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue || 'No disponible'
            },
            opportunities: lighthouseResult?.audits?.['uses-optimized-images']?.details?.items?.map(item => ({
                url: item.url,
                wastedBytes: item.wastedBytes,
                wastedMs: item.wastedMs || 'No disponible'
            })) || [],
            totalPageSize: lighthouseResult?.audits?.['total-byte-weight']?.displayValue || 'No disponible',
            estimatedLoadTime: lighthouseResult?.audits?.['interactive']?.displayValue || 'No disponible',
            additionalRecommendations: lighthouseResult?.audits?.['uses-long-cache-ttl']?.details?.items?.map(item => ({
                resource: item.url,
                cacheStatus: item.cacheLifetimeMs || 'No disponible'
            })) || []
        };

        res.status(200).json(filteredData);

    } catch (error) {
        console.error('Error al conectar con PageSpeed Insights:', error.message);
        res.status(500).json({ error: 'Error al analizar la URL' });
    }
});

const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("✅ Conexión a MongoDB Atlas exitosa");

        // Puedes listar las bases de datos disponibles
        const databasesList = await client.db().admin().listDatabases();
        console.log("Bases de datos disponibles:");
        databasesList.databases.forEach(db => console.log(` - ${db.name}`));
    } catch (error) {
        console.error("❌ Error conectando a MongoDB:", error.message);
        process.exit(1); // Termina el proceso si la conexión falla
    }
}

connectToDatabase();


// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
