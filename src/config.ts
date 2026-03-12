import dotenv from "dotenv";

dotenv.config();

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
}
