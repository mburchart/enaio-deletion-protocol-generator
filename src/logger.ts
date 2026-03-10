import winston from "winston";
import type { TransformableInfo } from "logform";
import Config from "./config";

export default class Logger {
  private static instance: winston.Logger | null = null;

  public static get(): winston.Logger {
    if (Logger.instance) return Logger.instance;
    const level = Config.readString("LOG_LEVEL", "info");
    const format = winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.colorize({ all: true }),
      winston.format.printf((info: TransformableInfo) => {
        const timestamp = String(info.timestamp ?? "");
        const logLevel = String(info.level ?? "");
        const message = String(info.message ?? "");
        return `[${timestamp}] ${logLevel}: ${message}`;
      }),
    );

    Logger.instance = winston.createLogger({
      level,
      format,
      transports: [new winston.transports.Console()],
    });

    return Logger.instance;
  }
}
