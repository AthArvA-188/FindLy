/**
 * File Preview API Service
 * Wrappers for /api/file/preview-image and /api/file/preview-text
 */

import { ApiError } from './client';

const BASE_URL = '/api';

/**
 * Build the URL for an image preview. Because the endpoint streams binary
 * content (image/png), we return a URL string that can be used directly as
 * an <img src>, rather than fetching a blob.
 *
 * GET /api/file/preview-image?path=...&page=...&scale=...
 *   - image files → streamed as-is
 *   - PDFs → requested page rendered to PNG
 */
export function getImagePreviewUrl(
  path: string,
  page: number = 1,
  scale: number = 2.0
): string {
  const params = new URLSearchParams({
    path,
    page: String(page),
    scale: String(scale),
  });
  return `${BASE_URL}/file/preview-image?${params.toString()}`;
}

/**
 * Fetch a text preview.
 *   - text files → chunked read (offset/limit bytes)
 *   - PDFs → quick text extraction from the first pages (up to `limit` chars)
 *
 * GET /api/file/preview-text?path=...&offset=...&limit=...
 * Response is PlainTextResponse (raw UTF-8 string).
 */
export async function getTextPreview(
  path: string,
  offset: number = 0,
  limit: number = 20000
): Promise<string> {
  const params = new URLSearchParams({
    path,
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`${BASE_URL}/file/preview-text?${params.toString()}`);
  if (!res.ok) {
    throw new ApiError(res.status, `Text preview failed: ${res.statusText}`);
  }
  return res.text();
}

/**
 * Classify a file path by extension into a preview mode.
 * Matches the backend's _detect_kind() logic, client-side.
 */
export type PreviewKind = 'image' | 'pdf' | 'text' | 'unsupported';

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico']);
const TEXT_EXT = new Set([
  'txt', 'md', 'log', 'json', 'xml', 'csv', 'yaml', 'yml',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs',
  'go', 'rs', 'rb', 'php', 'html', 'css', 'sh', 'sql',
]);

export function detectPreviewKind(path: string): PreviewKind {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (TEXT_EXT.has(ext)) return 'text';
  return 'unsupported';
}
