// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { sendEmail } = require('./emailService');
const { generateReport } = require('./openai');

const app = express();
app.use(cors());
app.use(express.json());

// Funciones auxiliares para obtener colores y estado
function getColor(value, metric) {
    switch (metric) {
        case 'fcp': return value <= 1.8 ? '#4caf50' : value <= 3 ? '#ff9800' : '#f44336';
        case 'lcp': return value <= 2.5 ? '#4caf50' : value <= 4 ? '#ff9800' : '#f44336';
        case 'si': return value <= 4.0 ? '#4caf50' : value <= 6 ? '#ff9800' : '#f44336';
        case 'tbt': return value <= 200 ? '#4caf50' : value <= 600 ? '#ff9800' : '#f44336';
        case 'cls': return value <= 0.1 ? '#4caf50' : value <= 0.25 ? '#ff9800' : '#f44336';
        default: return '#ffffff';
    }
}

function getStatus(value, metric) {
    switch (metric) {
        case 'fcp': return value <= 1.8 ? 'Bueno' : value <= 3 ? 'Mejorable' : 'Malo';
        case 'lcp': return value <= 2.5 ? 'Bueno' : value <= 4 ? 'Mejorable' : 'Malo';
        case 'si': return value <= 4.0 ? 'Bueno' : value <= 6 ? 'Mejorable' : 'Malo';
        case 'tbt': return value <= 200 ? 'Bueno' : value <= 600 ? 'Mejorable' : 'Malo';
        case 'cls': return value <= 0.1 ? 'Bueno' : value <= 0.25 ? 'Mejorable' : 'Malo';
        default: return 'Desconocido';
    }
}

// Función para procesar recomendaciones dinámicamente
function parseOpenAiRecommendations(report) {
    const recommendations = [];
    const matches = report.match(/\*\*(.+?):\*\*(.+?)(?=\*\*|$)/gs);
    if (matches) {
        matches.forEach(match => {
            const parts = match.split(':');
            recommendations.push({
                title: parts[0].replace('**', '').trim(),
                description: parts[1].replace('**', '').trim(),
            });
        });
    }
    return recommendations;
}

function generateRecommendationsHtml(recommendations) {
    return recommendations.map(rec => `
        <li style="margin-bottom: 10px;"><strong>${rec.title}:</strong> ${rec.description}</li>
    `).join('');
}

// Ruta raíz para verificar que el servidor esté funcionando
app.get('/', (req, res) => res.send('Servidor funcionando correctamente'));

// Endpoint para el flujo completo
app.post('/api/full-report', async (req, res) => {
    const { url, recipientEmail, recipientName } = req.body;

    // Validación de datos
    if (!url || !recipientEmail || !recipientName) {
        return res.status(400).json({ error: 'URL, correo y nombre del destinatario son requeridos.' });
    }

    // Establecer headers para streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        // 1. Analizar la URL con PageSpeed Insights
        res.write('🔍 Analizando la URL con PageSpeed Insights...\n');
        console.log('🔍 Analizando la URL con PageSpeed Insights...');
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}`;
        const pageSpeedResponse = await axios.get(apiUrl);

        const performanceData = {
            url: pageSpeedResponse.data.id || 'No disponible',
            performanceScore: pageSpeedResponse.data.lighthouseResult.categories.performance.score * 100 || 0,
            metrics: {
                firstContentfulPaint: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['first-contentful-paint']?.displayValue || '0'),
                largestContentfulPaint: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['largest-contentful-paint']?.displayValue || '0'),
                speedIndex: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['speed-index']?.displayValue || '0'),
                totalBlockingTime: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['total-blocking-time']?.displayValue || '0'),
                cumulativeLayoutShift: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['cumulative-layout-shift']?.displayValue || '0'),
            },
        };
        res.write('✅ Análisis de PageSpeed Insights completado.\n');
        console.log('✅ Análisis completado. Datos obtenidos:', performanceData);

        // 2. Generar el informe con OpenAI
        res.write('📝 Generando el informe con OpenAI...\n');
        console.log('📝 Generando el informe con OpenAI...');
        const prompt = `
Genera un informe profesional basado en estos datos de Google PageSpeed:
URL: ${url}
Puntuación general: ${performanceData.performanceScore}

Métricas clave:

FCP (First Contentful Paint): ${performanceData.metrics.firstContentfulPaint}
LCP (Largest Contentful Paint): ${performanceData.metrics.largestContentfulPaint}
SI (Speed Index): ${performanceData.metrics.speedIndex}
TBT (Total Blocking Time): ${performanceData.metrics.totalBlockingTime}
CLS (Cumulative Layout Shift): ${performanceData.metrics.cumulativeLayoutShift}

El informe debe incluir los siguientes apartados:

1. **Resumen del rendimiento general**:
   - Describe de manera breve cómo el sitio web está funcionando basado en las métricas clave.

2. **Análisis detallado**:
   - Explica el impacto de cada métrica clave en la experiencia del usuario y la velocidad de carga.

3. **Recomendaciones específicas** (en este formato estructurado):
   - **Título de la recomendación:** Descripción breve y clara de la acción a tomar.

   Ejemplo de recomendaciones:
   - **Optimizar imágenes:** Comprimir imágenes para reducir los tiempos de carga.
   - **Minificar CSS y JS:** Reducir el tamaño de los archivos CSS y JavaScript eliminando espacios innecesarios.
   - **Habilitar almacenamiento en caché del navegador:** Configurar el almacenamiento en caché para mejorar los tiempos de carga en visitas repetidas.
   - **Reducir scripts de terceros:** Evaluar y eliminar scripts de terceros innecesarios para mejorar el rendimiento.

Por favor, sigue esta estructura para que sea fácil de leer y entender por un público no técnico.
`;

        const report = await generateReport(prompt);
        res.write('✅ Informe generado con OpenAI.\n');
        // 3. Procesar las recomendaciones del informe
        const recommendations = parseOpenAiRecommendations(report);
        const recommendationsHtml = generateRecommendationsHtml(recommendations);

        // 4. Formatear el informe para la plantilla HTML
        const formattedReport = `
<table style="width: 600px; margin: auto; border-collapse: collapse; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden; font-family: 'Roboto', sans-serif; background-color: #f9f9f9;">
    <tr style="background-color: #007bff;">
        <td style="padding: 20px; text-align: center; color: #fff;">
            <h3 style="margin: 0; font-size: 24px;">Informe de Rendimiento para ${url}</h3>
        </td>
    </tr>
    <tr>
        <td style="padding: 20px;">
            <h4 style="font-size: 20px; color: #333; border-bottom: 2px solid #007bff;">Métricas Clave</h4>
            <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #fff;">
                <thead>
                    <tr style="background-color: #f1f1f1;">
                        <th style="padding: 12px;">Métrica</th>
                        <th style="padding: 12px;">Valor</th>
                        <th style="padding: 12px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px;">First Contentful Paint</td>
                        <td style="padding: 12px;">${performanceData.metrics.firstContentfulPaint} s</td>
                        <td style="padding: 12px; background-color: ${getColor(performanceData.metrics.firstContentfulPaint, 'fcp')}; color: #fff;">
                            ${getStatus(performanceData.metrics.firstContentfulPaint, 'fcp')}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px;">Largest Contentful Paint</td>
                        <td style="padding: 12px;">${performanceData.metrics.largestContentfulPaint} s</td>
                        <td style="padding: 12px; background-color: ${getColor(performanceData.metrics.largestContentfulPaint, 'lcp')}; color: #fff;">
                            ${getStatus(performanceData.metrics.largestContentfulPaint, 'lcp')}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px;">Speed Index</td>
                        <td style="padding: 12px;">${performanceData.metrics.speedIndex}</td>
                        <td style="padding: 12px; background-color: ${getColor(performanceData.metrics.speedIndex, 'si')}; color: #fff;">
                            ${getStatus(performanceData.metrics.speedIndex, 'si')}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px;">Total Blocking Time</td>
                        <td style="padding: 12px;">${performanceData.metrics.totalBlockingTime} ms</td>
                        <td style="padding: 12px; background-color: ${getColor(performanceData.metrics.totalBlockingTime, 'tbt')}; color: #fff;">
                            ${getStatus(performanceData.metrics.totalBlockingTime, 'tbt')}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px;">Cumulative Layout Shift</td>
                        <td style="padding: 12px;">${performanceData.metrics.cumulativeLayoutShift}</td>
                        <td style="padding: 12px; background-color: ${getColor(performanceData.metrics.cumulativeLayoutShift, 'cls')}; color: #fff;">
                            ${getStatus(performanceData.metrics.cumulativeLayoutShift, 'cls')}
                        </td>
                    </tr>
                </tbody>
            </table>
        </td>
    </tr>
    <tr>
        <td style="padding: 20px;">
            <h4 style="font-size: 20px; color: #333;">Recomendaciones</h4>
            <ul>${recommendationsHtml}</ul>
        </td>
    </tr>
</table>
`;

        console.log('✅ Informe generado:', formattedReport);
        res.write('📩 Enviando el informe por correo...\n');

        // 5. Enviar el informe por correo
        await sendEmail(recipientEmail, recipientName, url, formattedReport);
        console.log('✅ Correo enviado exitosamente.');
        res.write('✅ Correo enviado exitosamente.\n');
        
    } catch (error) {
        console.error('❌ Error en el flujo:', error.message);
        
        res.write(`❌ Error: ${error.message}\n`);
        res.end();
    }
});

// Configuración del puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));



// // Importar dependencias
// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const axios = require('axios');
// const { sendEmail } = require('./emailService');
// const { generateReport } = require('./openai');

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Funciones auxiliares para obtener colores y estado
// function getColor(value, metric) {
//     switch (metric) {
//         case 'fcp': return value <= 1.8 ? '#4caf50' : value <= 3 ? '#ff9800' : '#f44336';
//         case 'lcp': return value <= 2.5 ? '#4caf50' : value <= 4 ? '#ff9800' : '#f44336';
//         case 'si': return value <= 4.0 ? '#4caf50' : value <= 6 ? '#ff9800' : '#f44336';
//         case 'tbt': return value <= 200 ? '#4caf50' : value <= 600 ? '#ff9800' : '#f44336';
//         case 'cls': return value <= 0.1 ? '#4caf50' : value <= 0.25 ? '#ff9800' : '#f44336';
//         default: return '#ffffff';
//     }
// }

// function getStatus(value, metric) {
//     switch (metric) {
//         case 'fcp': return value <= 1.8 ? 'Bueno' : value <= 3 ? 'Mejorable' : 'Malo';
//         case 'lcp': return value <= 2.5 ? 'Bueno' : value <= 4 ? 'Mejorable' : 'Malo';
//         case 'si': return value <= 4.0 ? 'Bueno' : value <= 6 ? 'Mejorable' : 'Malo';
//         case 'tbt': return value <= 200 ? 'Bueno' : value <= 600 ? 'Mejorable' : 'Malo';
//         case 'cls': return value <= 0.1 ? 'Bueno' : value <= 0.25 ? 'Mejorable' : 'Malo';
//         default: return 'Desconocido';
//     }
// }

// // Función para procesar recomendaciones dinámicamente
// function parseOpenAiRecommendations(report) {
//     const recommendations = [];
//     const matches = report.match(/\*\*(.+?):\*\*(.+?)(?=\*\*|$)/gs);
//     if (matches) {
//         matches.forEach(match => {
//             const parts = match.split(':');
//             recommendations.push({
//                 title: parts[0].replace('**', '').trim(),
//                 description: parts[1].replace('**', '').trim(),
//             });
//         });
//     }
//     return recommendations;
// }

// function generateRecommendationsHtml(recommendations) {
//     return recommendations.map(rec => `
//         <li style="margin-bottom: 10px;"><strong>${rec.title}:</strong> ${rec.description}</li>
//     `).join('');
// }

// // Ruta raíz para verificar que el servidor esté funcionando
// app.get('/', (req, res) => res.send('Servidor funcionando correctamente'));





// // Endpoint para el flujo completo
// app.post('/api/full-report', async (req, res) => {
//     const { url, recipientEmail, recipientName } = req.body;

//     // Validación de datos
//     if (!url || !recipientEmail || !recipientName) {
//         return res.status(400).json({ error: 'URL, correo y nombre del destinatario son requeridos.' });
//     }

//     try {
//         // 1. Analizar la URL con PageSpeed Insights
//         console.log('🔍 Analizando la URL con PageSpeed Insights...');
//         const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}`;
//         const pageSpeedResponse = await axios.get(apiUrl);

//         const performanceData = {
//             url: pageSpeedResponse.data.id || 'No disponible',
//             performanceScore: pageSpeedResponse.data.lighthouseResult.categories.performance.score * 100 || 0,
//             metrics: {
//                 firstContentfulPaint: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['first-contentful-paint']?.displayValue || '0'),
//                 largestContentfulPaint: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['largest-contentful-paint']?.displayValue || '0'),
//                 speedIndex: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['speed-index']?.displayValue || '0'),
//                 totalBlockingTime: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['total-blocking-time']?.displayValue || '0'),
//                 cumulativeLayoutShift: parseFloat(pageSpeedResponse.data.lighthouseResult.audits['cumulative-layout-shift']?.displayValue || '0'),
//             },
//         };

//         console.log('✅ Análisis completado. Datos obtenidos:', performanceData);

//         // 2. Generar el informe con OpenAI
//         console.log('📝 Generando el informe con OpenAI...');
//         const prompt = `
// Genera un informe profesional basado en estos datos de Google PageSpeed:
// URL: ${url}
// Puntuación general: ${performanceData.performanceScore}

// Métricas clave:

// FCP (First Contentful Paint): ${performanceData.metrics.firstContentfulPaint}
// LCP (Largest Contentful Paint): ${performanceData.metrics.largestContentfulPaint}
// SI (Speed Index): ${performanceData.metrics.speedIndex}
// TBT (Total Blocking Time): ${performanceData.metrics.totalBlockingTime}
// CLS (Cumulative Layout Shift): ${performanceData.metrics.cumulativeLayoutShift}

// El informe debe incluir:

// Resumen del rendimiento general, tabla visual de métricas clave, análisis detallado y recomendaciones específicas.
// `;
//         const report = await generateReport(prompt);

//         // 3. Procesar las recomendaciones del informe
//         const recommendations = parseOpenAiRecommendations(report);
//         const recommendationsHtml = generateRecommendationsHtml(recommendations);

//         // 4. Formatear el informe para la plantilla HTML
//         const formattedReport = `
// <table style="width: 600px; margin: auto; border-collapse: collapse; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden; font-family: 'Roboto', sans-serif; background-color: #f9f9f9;">
//     <tr style="background-color: #007bff;">
//         <td style="padding: 20px; text-align: center; color: #fff;">
//             <h3 style="margin: 0; font-size: 24px;">Informe de Rendimiento para ${url}</h3>
//         </td>
//     </tr>
//     <tr>
//         <td style="padding: 20px;">
//             <h4 style="font-size: 20px; color: #333; border-bottom: 2px solid #007bff; display: inline-block; padding-bottom: 5px; margin-bottom: 20px;">Métricas Clave</h4>
//             <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);">
//                 <thead>
//                     <tr style="background-color: #f1f1f1; color: #333; font-weight: bold; text-align: center;">
//                         <th style="padding: 12px; border-bottom: 1px solid #ddd;">Métrica</th>
//                         <th style="padding: 12px; border-bottom: 1px solid #ddd;">Valor</th>
//                         <th style="padding: 12px; border-bottom: 1px solid #ddd;">Estado</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     <tr style="text-align: center;">
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">First Contentful Paint</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">${performanceData.metrics.firstContentfulPaint} s</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd; background-color: ${getColor(performanceData.metrics.firstContentfulPaint, 'fcp')}; color: #fff; border-radius: 4px;">
//                             ${getStatus(performanceData.metrics.firstContentfulPaint, 'fcp')}
//                         </td>
//                     </tr>
//                     <tr style="text-align: center;">
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">Largest Contentful Paint</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">${performanceData.metrics.largestContentfulPaint} s</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd; background-color: ${getColor(performanceData.metrics.largestContentfulPaint, 'lcp')}; color: #fff; border-radius: 4px;">
//                             ${getStatus(performanceData.metrics.largestContentfulPaint, 'lcp')}
//                         </td>
//                     </tr>
//                     <tr style="text-align: center;">
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">Cumulative Layout Shift</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">${performanceData.metrics.cumulativeLayoutShift}</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd; background-color: ${getColor(performanceData.metrics.cumulativeLayoutShift, 'cls')}; color: #fff; border-radius: 4px;">
//                             ${getStatus(performanceData.metrics.cumulativeLayoutShift, 'cls')}
//                         </td>
//                     </tr>
//                     <tr style="text-align: center;">
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">Time to Interactive</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd;">${performanceData.metrics.timeToInteractive} s</td>
//                         <td style="padding: 12px; border-bottom: 1px solid #ddd; background-color: ${getColor(performanceData.metrics.timeToInteractive, 'tti')}; color: #fff; border-radius: 4px;">
//                             ${getStatus(performanceData.metrics.timeToInteractive, 'tti')}
//                         </td>
//                     </tr>
//                 </tbody>
//             </table>
//         </td>
//     </tr>
//     <tr>
//         <td style="padding: 20px; background-color: #fff; border-top: 2px solid #007bff;">
//             <h4 style="font-size: 20px; color: #333; border-bottom: 2px solid #007bff; display: inline-block; padding-bottom: 5px; margin-bottom: 20px;">Explicaciones y Recomendaciones</h4>
//             <div style="font-size: 16px; line-height: 1.6; color: #555;">
//                 <ul style="margin-left: 20px; list-style-type: disc; color: #555; font-size: 16px;">
//                     ${recommendationsHtml}
//                 </ul>
//                 <p style="margin-top: 10px;">Con estas recomendaciones, puedes optimizar el rendimiento de tu sitio web y mejorar la experiencia del usuario.</p>
//             </div>
//         </td>
//     </tr>
// </table>
// `;

//         console.log('✅ Informe generado:', formattedReport);

//         // 5. Enviar el informe por correo
//         await sendEmail(recipientEmail, recipientName, url, formattedReport);
//         console.log('✅ Correo enviado exitosamente.');

//         res.status(200).json({ message: 'Flujo completado con éxito. Informe enviado.' });
//     } catch (error) {
//         console.error('❌ Error en el flujo:', error.message);
//         res.status(500).json({ error: 'Error en el flujo: ' + error.message });
//     }
// });

// // Configuración del puerto
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));


