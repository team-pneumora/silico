import * as fs from "node:fs";
import * as path from "node:path";
import winston from "winston";

const LOGS_DIR = path.resolve(import.meta.dirname, "../../logs");

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Creates a winston logger with console + file transports.
 * Each logger instance carries a `source` label (e.g. "Orchestrator", "CEO").
 */
export function createLogger(source: string) {
  const logger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { source },
    transports: [
      // Console: colorized, human-readable
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, source, message, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0
              ? ` ${JSON.stringify(meta)}`
              : "";
            return `[${timestamp}] [${level}] [${source}] ${message}${metaStr}`;
          })
        ),
      }),
      // File: structured JSON, one file per run
      new winston.transports.File({
        filename: path.join(LOGS_DIR, "silico.log"),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 10,
      }),
    ],
  });

  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, meta),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, meta),
  };
}

/**
 * Saves a round's full log as a JSON file in logs/.
 */
export function saveRoundLog(round: number, data: unknown): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  const filePath = path.join(LOGS_DIR, `round-${round}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
