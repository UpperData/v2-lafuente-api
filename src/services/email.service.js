import 'dotenv/config';
import nodemailer from 'nodemailer';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNewUserCredentialsEmail } from '../templates/userCreatedEmail.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const logoPath = resolve(currentDirectory, '../../public/logo-fuente.svg');

export async function sendNewUserCredentialsEmail({ to, password }) {
  const { GMAIL_ACCOUNT, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_ACCOUNT || !GMAIL_APP_PASSWORD) {
    throw new Error('Faltan las variables GMAIL_ACCOUNT o GMAIL_APP_PASSWORD.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_ACCOUNT,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  const logo = await readFile(logoPath);
  const message = createNewUserCredentialsEmail({ email: to, password });

  await transporter.sendMail({
    from: `La Fuente <${GMAIL_ACCOUNT}>`,
    to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: [{
      filename: 'logo-fuente.svg',
      content: logo,
      contentType: 'image/svg+xml',
      cid: 'logo-fuente',
    }],
  });
}
