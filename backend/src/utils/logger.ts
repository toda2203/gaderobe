// Simple console-based logger
const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[info]: ${message}`, meta || '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[error]: ${message}`, meta || '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[warn]: ${message}`, meta || '');
  },
  debug: (message: string, meta?: any) => {
    if (process.env.DEBUG) {
      console.debug(`[debug]: ${message}`, meta || '');
    }
  },
};

export default logger;
