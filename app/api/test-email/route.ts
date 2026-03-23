import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // We explicitly set a UTF-8 subject and HTML content with meta charset
    const subjectLine = 'Izveštaj o potrošnji - Test';
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body>
          <h2>Prikaži troškove</h2>
          <p>This is a test email to verify UTF-8 encoding support.</p>
          <p>Special characters: š, đ, č, ć, ž</p>
          <p>If you can read the characters above correctly, encoding works perfectly.</p>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Fleet Dashboard" <${process.env.GMAIL_USER}>`,
      to: 'risto.krivodolac@gmail.com',
      subject: subjectLine,
      html: htmlContent,
      // Setting character encoding explicitly
      textEncoding: 'base64',
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}
