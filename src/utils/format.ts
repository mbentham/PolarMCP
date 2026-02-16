import type { ResponseFormat } from "../types.js";

export function formatResponse<T>(
  data: T,
  format: ResponseFormat,
  markdownFormatter: (data: T) => string
): string {
  if (format === "json") {
    return JSON.stringify(data, null, 2);
  }
  return markdownFormatter(data);
}
