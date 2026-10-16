import type { UrlFetchLike } from '../http/GasHttpClient';
import type { DriveFileLike, DriveLike } from './gasTypes';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Drive v3 REST over UrlFetchApp with the script's OAuth token. DriveApp requires the
 * full `drive` scope; the REST API honors `drive.file` for files this app created (D17).
 */
export class GasDriveRest implements DriveLike {
  constructor(
    private readonly urlFetch: UrlFetchLike,
    private readonly token: () => string,
  ) {}

  createFile(name: string, content: string, mimeType: string): DriveFileLike {
    const boundary = `avocado${Date.now().toString(36)}`;
    const payload = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name, mimeType }),
      `--${boundary}`,
      `Content-Type: ${mimeType}; charset=UTF-8`,
      '',
      content,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const res = this.call(`${UPLOAD}?uploadType=multipart`, 'post', payload, `multipart/related; boundary=${boundary}`);
    return this.handle((JSON.parse(res) as { id: string }).id);
  }

  getFileById(id: string): DriveFileLike {
    this.call(`${API}/${encodeURIComponent(id)}?fields=id,trashed`, 'get');
    return this.handle(id);
  }

  private handle(id: string): DriveFileLike {
    const path = encodeURIComponent(id);
    return {
      getId: () => id,
      setContent: (content: string) =>
        this.call(`${UPLOAD}/${path}?uploadType=media`, 'patch', content, 'application/json; charset=UTF-8'),
      getBlob: () => ({ getDataAsString: () => this.call(`${API}/${path}?alt=media`, 'get') }),
      isTrashed: () => (JSON.parse(this.call(`${API}/${path}?fields=id,trashed`, 'get')) as { trashed?: boolean }).trashed === true,
    };
  }

  private call(url: string, method: 'get' | 'post' | 'patch', payload?: string, contentType?: string): string {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token()}` };
    if (contentType) headers['Content-Type'] = contentType;
    const res = this.urlFetch.fetch(url, {
      method,
      headers,
      ...(payload !== undefined ? { payload } : {}),
      muteHttpExceptions: true,
    });
    const status = res.getResponseCode();
    if (status < 200 || status >= 300) throw new Error(`Drive API ${status}: ${res.getContentText()}`);
    return res.getContentText('UTF-8');
  }
}
