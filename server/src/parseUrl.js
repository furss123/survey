/**
 * Extract Google Spreadsheet ID from various URL formats.
 */

const SPREADSHEET_ID_PATTERN =
  /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export function parseSpreadsheetId(url) {
  if (!url || typeof url !== "string") {
    throw new Error("유효한 Google Sheets URL이 필요합니다.");
  }

  const trimmed = url.trim();
  const match = trimmed.match(SPREADSHEET_ID_PATTERN);
  if (match?.[1]) {
    return match[1];
  }

  // Bare ID (no URL)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    "스프레드시트 ID를 URL에서 찾을 수 없습니다. 공유 링크 형식을 확인해 주세요."
  );
}
