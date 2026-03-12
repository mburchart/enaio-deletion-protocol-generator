import Config from "./config";
import nodemailer from "nodemailer";
import Logger from "./logger";

const logger = Logger.get();

export default class Email {
  private static instance: Email | null = null;
  private transporter: nodemailer.Transporter | null = null;

  public static get(): Email {
    if (Email.instance) return Email.instance;
    Email.instance = new Email();
    return Email.instance;
  }

  private constructor() {
    const host = Config.readString("EMAIL_HOST", "");
    const port = Config.readNumber("EMAIL_PORT", 587);
    const secure = Config.readBoolean("EMAIL_SECURE", false);
    const user = Config.readString("EMAIL_USER", "");
    const password = Config.readString("EMAIL_PASSWORD", "");

    if (host !== "" && user !== "" && password !== "") {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass: password,
        },
      });
      logger.info("E-Mail-Transport wurde initialisiert.");
    } else {
      logger.warn(
        "E-Mail-Transport ist nicht vollständig konfiguriert und bleibt deaktiviert.",
      );
    }
  }

  public async sendMail(
    to: string,
    subject: string,
    text: string,
  ): Promise<void> {
    if (!this.transporter) {
      logger.warn(
        "E-Mail-Versand übersprungen: E-Mail-Transport ist nicht konfiguriert.",
      );
      return;
    }

    try {
      const from = Config.readString("EMAIL_FROM", "");
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
      });
      logger.info(`Fehlerbenachrichtigung wurde an ${to} gesendet.`);
    } catch (error) {
      logger.error(
        `E-Mail-Versand fehlgeschlagen: ${
          error instanceof Error ? error.stack || error.message : String(error)
        }`,
      );
    }
  }
}
