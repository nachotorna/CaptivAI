
const axios = require('axios');

// Función para enviar el correo con contenido HTML directamente
async function sendEmail(recipientEmail, recipientName, url, formattedReport) {
    try {
        // Validar los parámetros
        if (!recipientEmail || !recipientName || !url || !formattedReport) {
            throw new Error('Faltan datos requeridos para enviar el correo.');
        }

        console.log('Datos enviados al correo:', {
            recipientEmail,
            recipientName,
            url,
        });

        console.log('Contenido de formattedReport:', formattedReport);

        // Enviar el correo con contenido HTML
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: { name: 'CaptivAI', email: 'nacho@labtorstudio.com' }, // Cambiar por tu remitente configurado
                to: [{ email: recipientEmail, name: recipientName }],
                subject: `Informe de Rendimiento para ${url}`, // Asunto del correo
                htmlContent: `
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                            <h1 style="color: #007bff;">Informe de Rendimiento</h1>
                            <p>Hola <strong>${recipientName}</strong>,</p>
                            <p>Gracias por utilizar <strong>CaptivAI</strong>. Aquí tienes el análisis de rendimiento para la página <a href="${url}" target="_blank">${url}</a>.</p>
                            <div style="margin-top: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
                                ${formattedReport} <!-- Aquí se incluye el contenido HTML del informe -->
                            </div>
                            <p style="margin-top: 20px;">Saludos,<br>El equipo de <strong>CaptivAI</strong></p>
                        </body>
                    </html>
                `,
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


