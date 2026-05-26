import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `${timestamp} [${level}] ${stack || message}${metaStr}`;
});

const prodFormat = printf((info) => JSON.stringify(info));

export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? prodFormat : combine(colorize(), devFormat)
  ),
  transports: [new transports.Console()],
});
