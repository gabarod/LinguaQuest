import winston from 'winston';
import 'winston-daily-rotate-file';

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'warn';
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
  }),
  new winston.transports.DailyRotateFile({
    filename: 'logs/all-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
  }),
];

export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

// Middleware para logging de HTTP requests
export const httpLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  next();
};

// Función para logging de eventos del sistema de aprendizaje
export const logLearningEvent = (userId: number, eventType: string, details: any) => {
  logger.info('Learning Event', {
    userId,
    eventType,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Función para logging de eventos de videollamada
export const logCallEvent = (callId: string, eventType: string, participants: number[]) => {
  logger.info('Call Event', {
    callId,
    eventType,
    participants,
    timestamp: new Date().toISOString(),
  });
};

// Función para logging de errores
export const logError = (error: Error, context: any = {}) => {
  logger.error('Application Error', {
    error: {
      message: error.message,
      stack: error.stack,
    },
    context,
    timestamp: new Date().toISOString(),
  });
};
