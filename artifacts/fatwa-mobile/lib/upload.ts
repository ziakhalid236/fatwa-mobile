import type * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

export const IMAGE_PICKER_OPTIONS = {
  mediaTypes: ['images'] as ImagePicker.MediaType[],
  quality: 0.85,
  // Native uploads are built from base64 because Expo's fetch cannot stream `{ uri }` form parts.
  base64: Platform.OS !== 'web',
};

async function nativeBytes(asset: ImagePicker.ImagePickerAsset): Promise<Uint8Array> {
  if (asset.base64) return base64ToBytes(asset.base64);
  const blob = await (await fetch(asset.uri)).blob();
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

/** Uploads one picked image as multipart/form-data, on web and on Android/iOS. */
export async function uploadImage(
  url: string,
  asset: ImagePicker.ImagePickerAsset,
  fileField: string,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Response> {
  const mime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  const fileName = asset.fileName ?? `upload-${Date.now()}.${mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'}`;

  if (Platform.OS === 'web') {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const file = asset.file ?? new File([await (await fetch(asset.uri)).blob()], fileName, { type: mime });
    form.append(fileField, file, fileName);
    return fetch(url, { method: 'POST', body: form, headers });
  }

  const boundary = `----FatwaBoundary${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${encodeURIComponent(fileName)}"\r\nContent-Type: ${mime}\r\n\r\n`));
  parts.push(await nativeBytes(asset));
  parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.length; }
  return fetch(url, { method: 'POST', body, headers: { ...headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` } });
}
