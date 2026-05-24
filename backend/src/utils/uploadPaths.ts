import path from "path";

const FOLDER_NAME_PATTERN = /[^a-zA-Z0-9-_ ]/g;
const FILE_NAME_PATTERN = /[^a-zA-Z0-9._-]/g;

export const sanitizeFolderName = (folderName: string) => {
  const normalized = folderName.trim().replace(FOLDER_NAME_PATTERN, "");

  if (!normalized) {
    throw new Error("Folder name is required.");
  }

  return normalized.replace(/\s+/g, "-");
};

export const sanitizeFileName = (fileName: string) => {
  const parsed = path.parse(fileName);
  const safeName = parsed.name.trim().replace(FILE_NAME_PATTERN, "-");
  const safeExt = parsed.ext.replace(FILE_NAME_PATTERN, "").toLowerCase();

  if (!safeName || !safeExt) {
    throw new Error(`Invalid file name: ${fileName}`);
  }

  return `${safeName}${safeExt}`;
};
