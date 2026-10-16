import type { ExhibitSegment, ExhibitStore } from '../../ports';

export class InMemoryExhibitStore implements ExhibitStore {
  private readonly texts = new Map<string, string>();

  async put(caseId: string, exhibitId: string, segments: ExhibitSegment[]): Promise<string> {
    const ref = `mem:${caseId}:${exhibitId}`;
    this.texts.set(ref, JSON.stringify(segments));
    return ref;
  }

  async get(textRef: string): Promise<ExhibitSegment[] | null> {
    const json = this.texts.get(textRef);
    return json ? (JSON.parse(json) as ExhibitSegment[]) : null;
  }
}
