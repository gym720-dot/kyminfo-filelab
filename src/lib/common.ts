export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function safeName(name: string): string {
  return name.replace(/[\\/\x00-\x1f<>:"|?*]/g, '-').slice(0, 120) || 'file';
}

export function resultName(name: string, suffix: string, ext: string): string {
  const stem = safeName(name).replace(/\.[^.]+$/, '');
  return `${stem}${suffix}.${ext}`;
}

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName(name);
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function signature(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'zip' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d) return 'png';
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return 'webp';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5 || bytes[2] === 7)) return 'zip';
  return null;
}

export async function fileSignature(file: File): Promise<ReturnType<typeof signature>> {
  return signature(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}
