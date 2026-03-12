import Logger from "./logger";
import Config from "./config";
import Email from "./email";
import { Database } from "./db";
import DeletionProtocolGenerator from "./deletion-protocol-generator";

const logger = Logger.get();

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

process.on("unhandledRejection", (reason) => {
  logger.error(`Unbehandelte Promise-Ablehnung: ${formatError(reason)}`);
});

class App {
  private static formatDate(date: Date): string {
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  public static async run() {
    logger.info("Programmstart: Löschprotokoll-Verarbeitung.");

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
    targetDate.setHours(0, 0, 0, 0);
    logger.info(
      `Verarbeite Löschungen für den ${App.formatDate(targetDate)}.`,
    );

    try {
      const generator = DeletionProtocolGenerator.getInstance();
      await generator.run(targetDate);
      logger.info("Löschprotokoll wurde erfolgreich erstellt.");
    } catch (error) {
      logger.error(`Fehler im Programmablauf: ${formatError(error)}`);

      const notificationRecipient = Config.readString(
        "EMAIL_ERROR_NOTIFICATION_TO",
        "",
      );
      const errorText = formatError(error);
      if (notificationRecipient) {
        logger.info(
          `Sende Fehlerbenachrichtigung an ${notificationRecipient}.`,
        );
        await Email.get().sendMail(
          notificationRecipient,
          "Fehler beim enaio Posteingang XML Kataloggenerator",
          errorText,
        );
      } else {
        logger.warn(
          "Fehlerbenachrichtigung übersprungen: keine Empfängeradresse konfiguriert.",
        );
      }
    } finally {
      try {
        await Database.close();
        logger.info("Datenbankverbindung wurde geschlossen.");
      } catch (closeError) {
        logger.error(
          `Datenbankverbindung konnte nicht geschlossen werden: ${formatError(closeError)}`,
        );
      }
    }

    logger.info("Programmende: Verarbeitung abgeschlossen.");
  }
}

(async () => {
  await App.run();
})();
