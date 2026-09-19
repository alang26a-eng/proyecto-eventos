import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const port = Number(process.env.PORT ?? 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido');
const mailPort = Number(process.env.MAIL_PORT || 587);
if (!Number.isInteger(mailPort) || mailPort < 1 || mailPort > 65535) throw new Error('MAIL_PORT inválido');
export const config = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGO_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  mail: {
    host: process.env.MAIL_HOST || '', port: mailPort,
    user: process.env.MAIL_USER || '', pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || '',
  },
};
