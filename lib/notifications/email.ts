import nodemailer from 'nodemailer';

export async function sendEmail(
    to: string,
    subject: string,
    htmlContent: string
): Promise<{ success: boolean; messageId?: string; error?: any }> {
    try {
        const isConfigured =
            process.env.SMTP_HOST &&
            process.env.SMTP_PORT &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS;

        let transporter;

        if (isConfigured) {
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT),
                secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        } else {
            console.log('⚠️ SMTP not configured, generating Ethereal test account...');
            let testAccount = await nodemailer.createTestAccount();

            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
        }

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Vela Support" <noreply@vela.app>',
            to,
            subject,
            html: htmlContent,
        });

        console.log(`✉️ Email sent to ${to}`);
        if (!isConfigured) {
            console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
}
