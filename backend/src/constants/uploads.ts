export const FILE_CATEGORY_BY_EXTENSION = {
  ".csv": "table",
  ".tsv": "table",
  ".xls": "table",
  ".xlsx": "table",
  ".ods": "table",
  ".pdf": "document",
  ".txt": "text",
  ".md": "text",
  ".json": "code",
  ".xml": "code",
  ".log": "code",
  ".js": "code",
  ".ts": "code",
  ".jsx": "code",
  ".tsx": "code",
  ".py": "code",
  ".css": "code",
  ".html": "code",
  ".yml": "code",
  ".yaml": "code",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
  ".gif": "image",
  ".svg": "image",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".ogg": "audio",
  ".zip": "archive",
  ".rar": "archive",
  ".7z": "archive",
  ".tar": "archive",
  ".gz": "archive",
  ".doc": "document",
  ".docx": "document",
  ".rtf": "document"
} as const;

export type FileCategory = (typeof FILE_CATEGORY_BY_EXTENSION)[keyof typeof FILE_CATEGORY_BY_EXTENSION];

export const SUPPORTED_FILE_EXTENSIONS = Object.keys(FILE_CATEGORY_BY_EXTENSION).sort();

export const TABLE_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS.filter(
  (extension) => FILE_CATEGORY_BY_EXTENSION[extension as keyof typeof FILE_CATEGORY_BY_EXTENSION] === "table"
);

export const IMAGE_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS.filter(
  (extension) => FILE_CATEGORY_BY_EXTENSION[extension as keyof typeof FILE_CATEGORY_BY_EXTENSION] === "image"
);

export const MEDIA_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS.filter((extension) => {
  const category = FILE_CATEGORY_BY_EXTENSION[extension as keyof typeof FILE_CATEGORY_BY_EXTENSION];
  return category === "audio" || category === "video";
});

export const TEXT_LIKE_EXTENSIONS = SUPPORTED_FILE_EXTENSIONS.filter((extension) => {
  const category = FILE_CATEGORY_BY_EXTENSION[extension as keyof typeof FILE_CATEGORY_BY_EXTENSION];
  return category === "text" || category === "code";
});

const MIME_CATEGORY_PREFIXES: Array<{ prefix: string; category: FileCategory }> = [
  { prefix: "image/", category: "image" },
  { prefix: "video/", category: "video" },
  { prefix: "audio/", category: "audio" },
  { prefix: "text/", category: "text" }
];

export const getFileCategory = (extension: string, mimeType: string): FileCategory | "unknown" => {
  const normalizedExtension = extension.toLowerCase();
  const byExtension =
    FILE_CATEGORY_BY_EXTENSION[
      normalizedExtension as keyof typeof FILE_CATEGORY_BY_EXTENSION
    ];

  if (byExtension) {
    return byExtension;
  }

  const lowerMimeType = mimeType.toLowerCase();

  if (
    lowerMimeType.includes("spreadsheet") ||
    lowerMimeType.includes("excel") ||
    lowerMimeType.includes("csv")
  ) {
    return "table";
  }

  if (lowerMimeType.includes("pdf") || lowerMimeType.includes("word")) {
    return "document";
  }

  if (lowerMimeType.includes("zip") || lowerMimeType.includes("compressed")) {
    return "archive";
  }

  const byPrefix = MIME_CATEGORY_PREFIXES.find((entry) => lowerMimeType.startsWith(entry.prefix));
  return byPrefix?.category || "unknown";
};

export const isSupportedFileType = (extension: string, mimeType: string) =>
  getFileCategory(extension, mimeType) !== "unknown";
