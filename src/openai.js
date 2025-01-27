const axios = require('axios');

// Configurar OpenAI con encabezado de autorización
async function generateReport(prompt) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Log para ver la respuesta completa de OpenAI
        console.log('Respuesta completa de OpenAI:', JSON.stringify(response.data, null, 2));

        // Extraer el contenido del informe
        const report = response.data.choices[0]?.message?.content?.trim();

        // Log para ver el contenido del informe
        console.log('Informe generado:', report);

        return report;
    } catch (error) {
        console.error('Error al llamar a la API de OpenAI:', error.response?.data || error.message);
        throw new Error('No se pudo generar el informe');
    }
}

module.exports = { generateReport };