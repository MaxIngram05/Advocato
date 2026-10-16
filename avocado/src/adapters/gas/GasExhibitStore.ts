import type { ExhibitSegment, ExhibitStore } from '../../ports';
import type { DriveLike } from './gasTypes';

/** Extracted exhibit text, one Drive file per exhibit; the ref is the Drive file id (§12). */
export class GasExhibitStore implements ExhibitStore {
  constructor(private readonly deps: { drive: DriveLike }) {}

  async put(caseId: string, exhibitId: string, segments: ExhibitSegment[]): Promise<string> {
    const file = this.deps.drive.createFile(
      `Avocado – ${caseId} – ${exhibitId}.json`,
      JSON.stringify(segments),
      'application/json',
    );
    return file.getId();
  }

  async get(textRef: string): Promise<ExhibitSegment[] | null> {
    try {
      return JSON.parse(this.deps.drive.getFileById(textRef).getBlob().getDataAsString('UTF-8')) as ExhibitSegment[];
    } catch {
      return null;
    }
  }
}
