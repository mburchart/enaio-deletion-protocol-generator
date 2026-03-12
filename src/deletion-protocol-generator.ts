import { Database } from "./db";
import Config, { type DeletionLogSourceConfig } from "./config";
import Logger from "./logger";
import fs from "fs";
import path from "path";

const logger = Logger.get();
const DEFAULT_LOG_FILE_PATH = "./deletion_protocol.log";
const CSV_HEADER =
  "DokumentenId;Schrankname;Vorgangsname;DokumentenBezeichnung;ErstelltAm;GelöschtAm;BenutzerId\n";
const DATETIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

type DeletionLogDatabaseRow = {
  id: number | string;
  documentName: string | null;
  userId: number | string | null;
  createdAtUnix: number | null;
  deletedAtUnix: number | null;
  cabinetName: string;
  processName: string | null;
};

type DeletionLogRow = {
  id: number | string;
  documentName: string;
  userId: number | string;
  createdAt: string;
  deletedAt: string;
  cabinetName: string;
  processName: string;
};

export default class DeletionProtocolGenerator {
  private static instance: DeletionProtocolGenerator | null = null;

  private constructor() {}

  public static getInstance(): DeletionProtocolGenerator {
    if (!this.instance) {
      this.instance = new DeletionProtocolGenerator();
    }
    return this.instance;
  }

  private static getDayUnixRange(date: Date): { startUnix: number; endUnix: number } {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return {
      startUnix: Math.floor(startOfDay.getTime() / 1000),
      endUnix: Math.floor(endOfDay.getTime() / 1000),
    };
  }

  private static formatTimestamp(timestamp: number | null): string {
    if (timestamp === null || !Number.isFinite(timestamp)) {
      return "";
    }
    return new Date(timestamp * 1000)
      .toLocaleString("de-DE", DATETIME_FORMAT_OPTIONS)
      .replace(",", "");
  }

  private static formatDateLabel(date: Date): string {
    return date.toLocaleDateString("de-DE", DATE_FORMAT_OPTIONS);
  }

  private static toDeletionLogRow(row: DeletionLogDatabaseRow): DeletionLogRow {
    return {
      id: row.id,
      documentName: row.documentName ?? "",
      userId: row.userId ?? "",
      createdAt: DeletionProtocolGenerator.formatTimestamp(row.createdAtUnix),
      deletedAt: DeletionProtocolGenerator.formatTimestamp(row.deletedAtUnix),
      cabinetName: row.cabinetName,
      processName: row.processName ?? "",
    };
  }

  private static toCsvRow(row: DeletionLogRow): string {
    return `${row.id};${row.cabinetName};${row.processName};${row.documentName};${row.createdAt};${row.deletedAt};${row.userId}`;
  }

  private getLogFilePath(): string {
    const configuredPath = Config.readString("DELETION_PROTOCOL_PATH", DEFAULT_LOG_FILE_PATH);
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  private appendRowsToLogFile(rows: DeletionLogRow[]): void {
    const logFilePath = this.getLogFilePath();
    const logDirectory = path.dirname(logFilePath);
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }

    const isNewFile = !fs.existsSync(logFilePath);
    if (isNewFile) {
      fs.writeFileSync(logFilePath, CSV_HEADER);
    }

    if (rows.length === 0) {
      logger.info("Keine Löschungen gefunden. Protokolldatei wurde nicht erweitert.");
      return;
    }

    const csvRows = rows.map(DeletionProtocolGenerator.toCsvRow).join("\n").concat("\n");
    fs.appendFileSync(logFilePath, csvRows);

    logger.info(
      `Löschprotokoll wurde aktualisiert: ${rows.length} Zeile(n) in ${logFilePath}.`,
    );
  }

  public async run(date: Date): Promise<void> {
    logger.info(
      `Starte Löschprotokoll-Erstellung für den ${DeletionProtocolGenerator.formatDateLabel(date)}.`,
    );
    const rows = await this.getRowsForDay(date);
    this.appendRowsToLogFile(rows);
    logger.info("Löschprotokoll-Erstellung abgeschlossen.");
  }

  private buildSourceQuery(
    schema: string,
    source: DeletionLogSourceConfig,
  ): string {
    return `
      SELECT
          o.id,
          o.${source.nameField} AS documentName,
          b.id AS userId,
          o.zeitstempel AS createdAtUnix,
          o.deleted AS deletedAtUnix,
          @cabinetName AS cabinetName,
          s.${source.processField} AS processName
      FROM ${schema}.${source.objectTable} o
      LEFT JOIN ${schema}.sdrel r
          ON r.object_id = o.id
      LEFT JOIN ${schema}.${source.masterTable} s
          ON s.id = r.stamm_id
      LEFT JOIN ${schema}.benutzer b
          ON o.modifyuser = b.benutzer
      WHERE o.deleted BETWEEN @start AND @end
      ORDER BY o.deleted DESC;
    `;
  }

  private async querySourceRows(
    schema: string,
    source: DeletionLogSourceConfig,
    startUnix: number,
    endUnix: number,
  ): Promise<DeletionLogDatabaseRow[]> {
    const query = this.buildSourceQuery(schema, source);

    logger.info(
      `Lese Löschungen aus Quelle "${source.label}" (${schema}.${source.objectTable}).`,
    );
    const result = await Database.query<DeletionLogDatabaseRow>(query, {
      start: startUnix,
      end: endUnix,
      cabinetName: source.label,
    });

    logger.info(`Quelle "${source.label}": ${result.recordset.length} Treffer.`);
    return result.recordset;
  }

  public async getRowsForDay(date: Date): Promise<DeletionLogRow[]> {
    const { startUnix, endUnix } = DeletionProtocolGenerator.getDayUnixRange(date);
    const schema = Config.readDeletionLogSchema();
    const sources = Config.readDeletionLogSources();

    logger.info(`Abfrage gestartet für ${sources.length} konfigurierte Quelle(n).`);
    const resultSets = await Promise.all(
      sources.map((source) =>
        this.querySourceRows(schema, source, startUnix, endUnix),
      ),
    );

    const rows = resultSets
      .flat()
      .sort((left, right) => (right.deletedAtUnix ?? 0) - (left.deletedAtUnix ?? 0))
      .map(DeletionProtocolGenerator.toDeletionLogRow);

    logger.info(`Abfrage abgeschlossen: ${rows.length} Löschungen insgesamt.`);
    return rows;
  }
}
