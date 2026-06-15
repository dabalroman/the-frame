export type UploadResult = {
  name?: string;
  ok?: boolean;
  error?: string;
  duplicate?: boolean;
  matchedName?: string;
};

export type UploadOptions = { force?: boolean };

type UploadCallbacks = {
  onFileDone: (result: UploadResult, file: File, done: number, total: number) => void;
  onUploadComplete: (results: UploadResult[]) => void;
};

// Ported from random-tools' eink-frame uploadFiles.ts (#185). Only the endpoint
// path changed (`/api/eink/images` → `/api/images`).
export async function uploadFiles(
  files: File[],
  { onFileDone, onUploadComplete }: UploadCallbacks,
  { force = false }: UploadOptions = {},
) {
  const results: UploadResult[] = [];
  const url = force ? '/api/images?force=1' : '/api/images';
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const form = new FormData();
    form.append('files', file);
    let result: UploadResult;
    try {
      const res = await fetch(url, { method: 'POST', body: form });
      const data = res.status === 207
        ? (await res.json() as UploadResult[])[0]
        : undefined;
      result = data ?? { error: `HTTP ${res.status}` };
    } catch (err) {
      result = { error: String(err) };
    }
    results.push(result);
    onFileDone(result, file, i + 1, files.length);
  }
  onUploadComplete(results);
}
