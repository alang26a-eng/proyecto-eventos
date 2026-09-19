import nodemailer from 'nodemailer';
import { config } from '../config/env.config.js';

let transport;
export async function sendConfirmation(user, event, ticket) {
  const mail = config.mail;
  if (!mail.host || !mail.from) throw new Error('SMTP no configurado');
  transport ??= nodemailer.createTransport({
    host: mail.host, port: mail.port, secure: mail.port === 465,
    auth: mail.user && mail.pass ? { user: mail.user, pass: mail.pass } : undefined,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const result = await transport.sendMail({
    from: mail.from, to: user.email,
    subject: 'Confirmación de inscripción - EventHub',
    text: [
      'Hola ' + user.first_name + ',',
      'Tu inscripción está confirmada.',
      'Evento: ' + event.title,
      'Fecha (UTC): ' + event.date.toISOString(),
      'Ubicación: ' + event.location,
      'Cantidad: ' + ticket.quantity,
      'Código de reserva: ' + ticket.reservationCode,
    ].join('\n'),
  });
  if (!result.accepted?.length) throw new Error('SMTP rechazó el destinatario');
}
