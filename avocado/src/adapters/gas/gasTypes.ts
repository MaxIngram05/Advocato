/**
 * The slices of Apps Script services our adapters use. Typed narrowly so the
 * adapters can be exercised with in-memory mocks (and the real globals satisfy them).
 */
export interface DriveFileLike {
  getId(): string;
  setContent(content: string): unknown;
  getBlob(): { getDataAsString(charset?: string): string };
  isTrashed(): boolean;
}

export interface DriveLike {
  createFile(name: string, content: string, mimeType: string): DriveFileLike;
  getFileById(id: string): DriveFileLike;
}

export interface PropertiesLike {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): unknown;
}
