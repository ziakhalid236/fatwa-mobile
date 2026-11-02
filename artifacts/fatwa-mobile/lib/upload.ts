import type * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i)] = i;
  return table;
})();

// Table-based decoder: fast even for multi-megabyte photos (the old indexOf loop froze the app).
function base64ToBytes(input: string): Uint8Array {
  const out = new Uint8Array(Math.floor((input.length * 3) / 4));
  let o = 0;
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const v = code < 128 ? LOOKUP[code] : -1;
    if (v < 0) continue;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  return out.subarray(0, o);
}

export const IMAGE_PICKER_OPTIONS = {
  mediaTypes: ['images'] as ImagePicker.MediaType[],
  // Lower quality keeps phone photos small enough to upload quickly without running out of memory.
  quality: 0.5,
  // Native uploads are built from base64 because Expo's fetch cannot stream `{ uri }` form parts.
  base64: Platform.OS !== 'web',
};

async function nativeBytes(asset: ImagePicker.ImagePickerAsset): Promise<Uint8Array> {
  if (asset.base64) return base64ToBytes(asset.base64);
  const blob = await (await fetch(asset.uri)).blob();
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

/** Uploads one picked image as multipart/form-data, on web and on Android/iOS. */
export function uploadImage(url: string, asset: ImagePicker.ImagePickerAsset, fileField: string, fields: Record<string, string>, headers: Record<string, string> = {}): Promise<Response> {
  return uploadImages(url, [asset], fileField, fields, headers);
}

/** Uploads several picked images (same field name repeated) as multipart/form-data. */
export async function uploadImages(
  url: string,
  assets: ImagePicker.ImagePickerAsset[],
  fileField: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Response> {
  const named = assets.map((asset, i) => {
    const mime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
    return { asset, mime, fileName: asset.fileName ?? `upload-${Date.now()}-${i}.${mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'}` };
  });

  if (Platform.OS === 'web') {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    for (const { asset, mime, fileName } of named) {
      const file = asset.file ?? new File([await (await fetch(asset.uri)).blob()], fileName, { type: mime });
      form.append(fileField, file, fileName);
    }
    return fetch(url, { method: 'POST', body: form, headers });
  }

  const boundary = `----FatwaBoundary${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  for (const { asset, mime, fileName } of named) {
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${encodeURIComponent(fileName)}"\r\nContent-Type: ${mime}\r\n\r\n`));
    parts.push(await nativeBytes(asset));
    parts.push(encoder.encode('\r\n'));
  }
  parts.push(encoder.encode(`--${boundary}--\r\n`));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.length; }
  return fetch(url, { method: 'POST', body, headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
}

export async function uploadVideo(
  url: string,
  asset: ImagePicker.ImagePickerAsset,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
  onProgress?: (progress: number) => void,
): Promise<{ ok: boolean; status: number; body: { error?: string; id?: string } }> {
  if (Platform.OS === 'web') {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const mime = asset.mimeType ?? 'video/mp4';
    const fileName = asset.fileName ?? `community-${Date.now()}.mp4`;
    const file = asset.file ?? new File([await (await fetch(asset.uri)).blob()], fileName, { type: mime });
    form.append('video', file, fileName);
    const response = await fetch(url, { method: 'POST', body: form, headers });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
  }

  const { backgroundUpload, UploadType } = await import('react-native-compressor');
  const response = await backgroundUpload(url, asset.uri, {
    uploadType: UploadType.MULTIPART,
    fieldName: 'video',
    mimeType: 'video/mp4',
    parameters: fields,
    headers,
  }, (written, total) => { if (total > 0) onProgress?.(Math.round((written / total) * 100)); });
  let body: { error?: string; id?: string } = {};
  try { body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body ?? {}; } catch { body = {}; }
  const status = Number(response.status || 0);
  return { ok: status >= 200 && status < 300, status, body };
}
