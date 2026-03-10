import dotenv from "dotenv";

dotenv.config();

export type DeletionLogSourceConfig = {
  label: string;
  objectTable: string;
  nameField: string;
  masterTable: string;
  processField: string;
};

const SQL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RLOG_LABEL_PATTERN = /^[^;\r\n]+$/;

export default class Config {
  private static readRaw(key: string): string | undefined {
    const raw = process.env[key];
    if (raw === undefined || raw === "") return undefined;
    return raw;
  }

  public static readString(key: string, defaultValue = ""): string {
    return Config.readRaw(key) ?? defaultValue;
  }

  public static readNumber(key: string, defaultValue = 0): number {
    const raw = Config.readRaw(key);
    if (raw === undefined) return defaultValue;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  public static readBoolean(key: string, defaultValue = false): boolean {
    const raw = Config.readRaw(key);
    if (raw === undefined) return defaultValue;
    return ["1", "true", "yes", "y", "on"].includes(raw.toLowerCase());
  }

  public static readList(key: string): string[] {
    return Config.readString(key, "")
      .split("|")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
  }

  private static assertSqlIdentifier(value: string, context: string): string {
    if (!SQL_IDENTIFIER_PATTERN.test(value)) {
      throw new Error(
        `${context} enthaelt einen ungueltigen SQL-Identifier: "${value}"`,
      );
    }
    return value;
  }

  private static assertRlogLabel(value: string, context: string): string {
    if (!RLOG_LABEL_PATTERN.test(value)) {
      throw new Error(
        `${context} enthaelt ein ungueltiges Label: "${value}". ";" und Zeilenumbrueche sind nicht erlaubt.`,
      );
    }
    return value;
  }

  private static parseDeletionLogSource(
    rawSource: string,
    position: number,
  ): DeletionLogSourceConfig {
    const parts = rawSource.split(",").map((part) => part.trim());
    if (parts.length !== 5 || parts.some((part) => part.length === 0)) {
      throw new Error(
        `RLOG_SOURCES Eintrag ${position} ist ungueltig. Erwartetes Format: label,objectTable,nameField,masterTable,processField`,
      );
    }

    const [label, objectTable, nameField, masterTable, processField] = parts;
    return {
      label: Config.assertRlogLabel(
        label,
        `RLOG_SOURCES[${position}].label`,
      ),
      objectTable: Config.assertSqlIdentifier(
        objectTable,
        `RLOG_SOURCES[${position}].objectTable`,
      ),
      nameField: Config.assertSqlIdentifier(
        nameField,
        `RLOG_SOURCES[${position}].nameField`,
      ),
      masterTable: Config.assertSqlIdentifier(
        masterTable,
        `RLOG_SOURCES[${position}].masterTable`,
      ),
      processField: Config.assertSqlIdentifier(
        processField,
        `RLOG_SOURCES[${position}].processField`,
      ),
    };
  }

  public static readDeletionLogSchema(): string {
    const schema = Config.readString("RLOG_SCHEMA", "sysadm").trim();
    return Config.assertSqlIdentifier(schema, "RLOG_SCHEMA");
  }

  public static readDeletionLogSources(): DeletionLogSourceConfig[] {
    const sourceEntries = Config.readList("RLOG_SOURCES");
    const defaults = [
      "VA,object43,feld8,stamm30,feld21",
      "ASV,object14,feld3,stamm12,feld15",
    ];
    const sources = sourceEntries.length > 0 ? sourceEntries : defaults;
    return sources.map((entry, index) =>
      Config.parseDeletionLogSource(entry, index + 1),
    );
  }
}
