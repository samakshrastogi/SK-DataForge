import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import XLSX from "xlsx";
import { TABLE_EXTENSIONS, TEXT_LIKE_EXTENSIONS } from "../constants/uploads";

type RawCell = string | number | boolean | Date | null;

const formatCellValue = (value: RawCell | undefined) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export const computeFileHashFromBuffer = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

export const computeFileHashFromPath = async (absolutePath: string) =>
  computeFileHashFromBuffer(await fs.readFile(absolutePath));

export const getTableRows = (absolutePath: string) => {
  const workbook = XLSX.readFile(absolutePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { columns: [] as string[], rows: [] as string[][] };
  }

  const sheet = workbook.Sheets[sheetName];
  const table = XLSX.utils.sheet_to_json<RawCell[]>(sheet, {
    header: 1,
    defval: ""
  });

  if (table.length === 0) {
    return { columns: [] as string[], rows: [] as string[][] };
  }

  const maxWidth = table.reduce((width, row) => Math.max(width, row.length), 0);
  const firstRow = table[0];
  const columns = Array.from({ length: maxWidth }, (_, index) => {
    const headerValue = firstRow[index];
    return headerValue ? String(headerValue) : `Column ${index + 1}`;
  });
  const rows = table.slice(1).map((row) =>
    Array.from({ length: maxWidth }, (_, columnIndex) => formatCellValue(row[columnIndex]))
  );

  return { columns, rows };
};

export const extractSearchableContent = async (
  absolutePath: string,
  extension: string,
  category: string
) => {
  if (category === "table" && TABLE_EXTENSIONS.includes(extension)) {
    const { columns, rows } = getTableRows(absolutePath);
    return [columns.join(" "), ...rows.map((row) => row.join(" "))].join("\n");
  }

  if (category === "text" || category === "code" || TEXT_LIKE_EXTENSIONS.includes(extension)) {
    return fs.readFile(absolutePath, "utf8");
  }

  return "";
};

export const buildSnippet = (content: string, query: string, radius = 80) => {
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const matchIndex = normalizedContent.indexOf(normalizedQuery);

  if (matchIndex < 0) {
    return null;
  }

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(content.length, matchIndex + query.length + radius);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  return `${prefix}${content.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
};

export const resolveAbsoluteFilePath = (relativePath: string) =>
  path.resolve(process.cwd(), relativePath);
