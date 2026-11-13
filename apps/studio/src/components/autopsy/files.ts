import { api, type Mission } from '@/state';

/** The saved file path of an artifact version such as "mentor-schedule.csv@v1", or null when the ledger never wrote it. */
export function versionFile(mission: Mission, tag: string): string | null {
  for (const entry of Object.values(mission.files)) {
    for (const v of entry.versions) {
      if (`${v.name}@v${v.version}` === tag) return v.file;
    }
  }
  return null;
}

/** Reads a saved file through the server. Any failure becomes "Could not open <tag>". */
export function loadText(runId: string | null, file: string | null, tag: string): Promise<string> {
  if (!runId || !file) return Promise.reject(new Error(`Could not open ${tag}`));
  return api.fileText(runId, file).catch(() => {
    throw new Error(`Could not open ${tag}`);
  });
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
