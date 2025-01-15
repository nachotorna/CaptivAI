const axios = require('axios');

// Función para enviar el correo con plantilla de Brevo
async function sendEmail(recipientEmail, recipientName, url, formattedReport) {
    try {
        console.log('Datos enviados al correo:', {
            recipientEmail,
            recipientName,
            url,
            formattedReport,
        });

        // Enviar el correo con la plantilla
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: { name: 'CaptivAI', email: 'nacho@labtorstudio.com' },
                to: [{ email: recipientEmail, name: recipientName }],
                templateId: 1, // Reemplaza con el ID correcto de tu plantilla
                params: {
                    URL: url,
                    NAME: recipientName,
                    REPORT: formattedReport, // Pasamos el contenido como parámetro
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': process.env.BREVO_API_KEY,
                },
            }
        );

        console.log('Correo enviado exitosamente:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error al enviar el correo:', error.response?.data || error.message);
        throw new Error('No se pudo enviar el correo.');
    }
}

module.exports = { sendEmail };
