type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL: LogLevel = 'info'

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL]
}

function format(level: LogLevel, module: string, message: string): string {
  const time = new Date().toISOString().slice(11, 23)
  return `[${time}] [${level.toUpperCase()}] [${module}] ${message}`
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, ...args: any[]) => {
      if (shouldLog('debug')) console.debug(format('debug', module, msg), ...args)
    },
    info: (msg: string, ...args: any[]) => {
      if (shouldLog('info')) console.log(format('info', module, msg), ...args)
    },
    warn: (msg: string, ...args: any[]) => {
      if (shouldLog('warn')) console.warn(format('warn', module, msg), ...args)
    },
    error: (msg: string, ...args: any[]) => {
      if (shouldLog('error')) console.error(format('error', module, msg), ...args)
    },
  }
}
