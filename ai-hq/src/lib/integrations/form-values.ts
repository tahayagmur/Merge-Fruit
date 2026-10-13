import type { SettingField } from "./types";

/** Select value used for "no option chosen". */
export const NOT_SET = "__not_set__";

/** Stored setting → form string. */
export function toFormValue(field: SettingField, value: unknown): string {
  if (value === undefined || value === null) return field.type === "select" ? NOT_SET : "";
  if (field.type === "list" && Array.isArray(value)) return value.join("\n");
  return String(value);
}

/** Form strings → typed settings. Empty optional values are left out; the server validates the result. */
export function toSettings(fields: SettingField[], values: Record<string, string>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.key] ?? "";
    if (field.type === "list") {
      const items = raw
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length) settings[field.key] = items;
    } else if (field.type === "number") {
      if (raw.trim() !== "") settings[field.key] = Number(raw);
    } else if (field.type === "select") {
      if (raw && raw !== NOT_SET) settings[field.key] = raw;
    } else if (raw.trim() !== "") {
      settings[field.key] = raw.trim();
    }
  }
  return settings;
}
