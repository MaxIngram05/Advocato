/**
 * In-memory stand-ins for the slices of Apps Script globals our GAS adapters use.
 * They mimic the synchronous Apps Script API shape.
 */

export class FakeDrive {
  readonly files = new Map<string, { name: string; content: string; mime: string }>();
  private seq = 0;

  createFile(name: string, content: string, mime: string) {
    const id = `drive-${++this.seq}`;
    this.files.set(id, { name, content, mime });
    return this.handle(id);
  }

  getFileById(id: string) {
    if (!this.files.has(id)) throw new Error(`No item with the given ID could be found: ${id}`);
    return this.handle(id);
  }

  private handle(id: string) {
    const files = this.files;
    return {
      getId: () => id,
      getName: () => files.get(id)?.name ?? '',
      setContent: (content: string) => {
        const f = files.get(id);
        if (f) f.content = content;
        return this.handle(id);
      },
      getBlob: () => ({ getDataAsString: (_charset?: string) => files.get(id)?.content ?? '' }),
      isTrashed: () => false,
    };
  }
}

export class FakeProperties {
  private readonly values = new Map<string, string>();
  getProperty(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setProperty(key: string, value: string) {
    this.values.set(key, value);
    return this;
  }
  deleteProperty(key: string) {
    this.values.delete(key);
    return this;
  }
}

/** Per-document properties, so the contract suite can exercise several documents. */
export function fakeDocumentProperties() {
  const byDoc = new Map<string, FakeProperties>();
  return (docId: string) => {
    if (!byDoc.has(docId)) byDoc.set(docId, new FakeProperties());
    return byDoc.get(docId) as FakeProperties;
  };
}
