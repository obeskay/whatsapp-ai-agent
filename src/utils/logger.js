import winston from 'winston';
import chalk from 'chalk';

const customFormat = winston.format.printf(({ level, message, timestamp }) => {
  let coloredLevel;

  switch (level) {
    case 'error':
      coloredLevel = chalk.red(`[${level.toUpperCase()}]`);
      break;
    case 'warn':
      coloredLevel = chalk.yellow(`[${level.toUpperCase()}]`);
      break;
    case 'info':
      coloredLevel = chalk.blue(`[${level.toUpperCase()}]`);
      break;
    case 'debug':
      coloredLevel = chalk.gray(`[${level.toUpperCase()}]`);
      break;
    default:
      coloredLevel = `[${level.toUpperCase()}]`;
  }

  return `${chalk.gray(timestamp)} ${coloredLevel} ${message}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat()
  ),
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        customFormat
      )
    }),
    // File output for errors
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: winston.format.json()
    }),
    // File output for all logs
    new winston.transports.File({
      filename: 'app.log',
      format: winston.format.json()
    })
  ]
});

// Prevent unhandled promise rejections from crashing the app
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});