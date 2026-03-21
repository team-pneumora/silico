import * as fs from "node:fs";
import * as path from "node:path";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  data?: unknown;
}

const LOGS_DIR = path.resolve(import.meta.dirname, "../../logs");

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function formatEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]`;
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${prefix} ${entry.message}${dataStr}`;
}

function writeToFile(round: number, entry: LogEntry): void {
  ensureLogsDir();
  const filePath = path.join(LOGS_DIR, `round-${round}.log`);
  fs.appendFileSync(filePath, formatEntry(entry) + "\n");
}

export function createLogger(source: string) {
  let currentRound = 0;

  function log(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
      data,
    };

    const formatted = formatEntry(entry);

    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    if (currentRound > 0) {
      writeToFile(currentRound, entry);
    }
  }

  return {
    setRound(round: number) {
      currentRound = round;
    },
    info: (message: string, data?: unknown) => log("info", message, data),
    warn: (message: string, data?: unknown) => log("warn", message, data),
    error: (message: string, data?: unknown) => log("error", message, data),
    debug: (message: string, data?: unknown) => log("debug", message, data),
  };
}

export function saveRoundLog(round: number, data: unknown): void {
  ensureLogsDir();
  const filePath = path.join(LOGS_DIR, `round-${round}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
