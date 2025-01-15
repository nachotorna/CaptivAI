// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { sendEmail } = require('./emailService');
const { generateReport } = require('./openai');
const connectDB = require('./database'); // Importa tu módulo de conexión a MongoDB

const app = express();
app.use(cors());
app.use(express.json());

// Ruta raíz para verificar que el servidor esté funcionando
app.get('/', (req, res) => res.send('Servidor funcionando correctamente'));

// Función para guardar análisis en MongoDB
async function saveAnalysisToDB(data) {
    try {
        const db = await connectDB();
        const collection = db.collection('analyses'); // Cambia 'analyses' por el nombre de tu colección
        const result = await collection.insertOne(data);
        console.log('✅ Datos guardados en MongoDB:', result);
    } catch (error) {
        console.error('❌ Error al guardar los datos en MongoDB:', error.message);
    }
}

// Endpoint para el flujo completo
app.post('/api/full-report', async (req, res) => {
    const { url, recipientEmail, recipientName } = req.body;

    // Validación de datos
    if (!url || !recipientEmail || !recipientName) {
        return res.status(400).json({ error: 'URL, correo y nombre del destinatario son requeridos.' });
    }

    try {
        // 1. Analizar la URL con PageSpeed Insights
        console.log('🔍 Analizando la URL con PageSpeed Insights...');
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}`;
        const pageSpeedResponse = await axios.get(apiUrl);

        const performanceData = {
            url: pageSpeedResponse.data.id || 'No disponible',
            performanceScore: pageSpeedResponse.data.lighthouseResult.categories.performance.score * 100 || 0,
            metrics: {
                firstContentfulPaint: pageSpeedResponse.data.lighthouseResult.audits['first-contentful-paint']?.displayValue || 'No disponible',
                largestContentfulPaint: pageSpeedResponse.data.lighthouseResult.audits['largest-contentful-paint']?.displayValue || 'No disponible',
                speedIndex: pageSpeedResponse.data.lighthouseResult.audits['speed-index']?.displayValue || 'No disponible',
                totalBlockingTime: pageSpeedResponse.data.lighthouseResult.audits['total-blocking-time']?.displayValue || 'No disponible',
                cumulativeLayoutShift: pageSpeedResponse.data.lighthouseResult.audits['cumulative-layout-shift']?.displayValue || 'No disponible',
            },
        };

        console.log('✅ Análisis completado. Datos obtenidos:', performanceData);

        // 2. Generar el informe con OpenAI
        console.log('📝 Generando el informe con OpenAI...');
        const prompt = `
        Aquí tienes los datos de rendimiento para la URL: ${url}.
        Puntuación general: ${performanceData.performanceScore}.
        Métricas clave:
        - First Contentful Paint: ${performanceData.metrics.firstContentfulPaint}.
        - Largest Contentful Paint: ${performanceData.metrics.largestContentfulPaint}.
        - Speed Index: ${performanceData.metrics.speedIndex}.
        - Total Blocking Time: ${performanceData.metrics.totalBlockingTime}.
        - Cumulative Layout Shift: ${performanceData.metrics.cumulativeLayoutShift}.
        
        Basándote en esta información, genera un informe profesional que incluya:
        1. Resumen del rendimiento general.
        2. Análisis detallado de las métricas clave.
        3. Recomendaciones específicas y prácticas para mejorar el rendimiento.
        `;
        const report = await generateReport(prompt);

        // 3. Formatear el informe para la plantilla
        const formattedReport = `
            <h3>Informe de Rendimiento para ${url}</h3>
            <ol>
                <li><strong>Resumen del rendimiento general:</strong>
                    <p>${report.split('\n\n')[0]}</p>
                </li>
                <li><strong>Análisis detallado de las métricas clave:</strong>
                    <ul>
                        ${report.split('\n\n')[1]
                          .split('\n')
                          .map(line => line.trim() ? `<li>${line.trim()}</li>` : '')
                          .join('')}
                    </ul>
                </li>
                <li><strong>Recomendaciones específicas y prácticas:</strong>
                    <p>${report.split('\n\n')[2]}</p>
                </li>
            </ol>
        `;

        console.log('✅ Informe generado:', formattedReport);

        // 4. Enviar el informe por correo
        await sendEmail(recipientEmail, recipientName, url, formattedReport);
        console.log('✅ Correo enviado exitosamente.');

        // 5. Guardar datos en MongoDB
        const analysisData = {
            url,
            recipientEmail,
            recipientName,
            performanceData,
            report,
            timestamp: new Date(),
        };
        await saveAnalysisToDB(analysisData);

        console.log('✅ Datos guardados en la base de datos.');

        res.status(200).json({ message: 'Flujo completado con éxito. Informe enviado y datos guardados en la base de datos.' });
    } catch (error) {
        console.error('❌ Error en el flujo:', error.message);
        res.status(500).json({ error: 'Error en el flujo: ' + error.message });
    }
});

// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
