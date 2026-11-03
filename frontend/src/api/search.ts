/**
 * Search API Service
 * Handles text and image-based semantic search
 */

import { api } from './client';
import type { SearchResult, FileType } from '../types';

interface TextSearchRequest {
  query: string;
  fileTypes?: FileType[];
  confinedPaths?: string[];
}

interface ImageSearchRequest {
  image: File;
  fileTypes?: FileType[];
  confinedPaths?: string[];
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}

// Shape returned by backend_2 /api/search-pc
interface BackendSearchHit {
  score: number;
  payload: {
    file_path: string;
    type: string;       // "text" | "image"
    file_kind?: string; // "text" | "code" | "pdf" | "image" | "binary"
    text?: string;      // chunk text for text results
    hash?: string;
  };
}

interface BackendSearchResponse {
  search_type: string;
  query_type: string;
  results: BackendSearchHit[];
}

/** Map backend_2 result shape → frontend SearchResult */
function mapResult(r: BackendSearchHit, index: number): SearchResult {
  return {
    id: `${r.payload.file_path}-${index}`,
    path: r.payload.file_path,
    confidence: r.score,
    preview: r.payload.text || '',
    fileType: r.payload.file_kind || r.payload.type,
  };
}

/**
 * Map frontend FileType filter values to backend file_kind values and
 * determine which embedding spaces (text / image) need to be queried.
 *
 * Backend file_kind values: "text" | "pdf" | "image" | "binary"
 * search_for="text"  → searches mpnet vector space (text/PDF chunks)
 * search_for="image" → searches CLIP vector space  (image files)
 */
const FILE_KIND_MAP: Partial<Record<FileType, string[]>> = {
  pdf:   ['pdf'],
  doc:   ['binary'],  // .doc/.docx are detected as binary; backend indexes these as binary kind
  txt:   ['text'],
  image: ['image'],
  code:  ['code'],
};

function getSearchConfig(fileTypes: FileType[]): {
  searchForText: boolean;
  searchForImage: boolean;
  fileKinds: string[];
} {
  const isAll = fileTypes.includes('all');

  // Which embedding spaces to query
  const searchForText  = isAll || fileTypes.some(t => ['pdf', 'doc', 'txt', 'code'].includes(t));
  const searchForImage = isAll || fileTypes.includes('image');

  // file_kind values to filter by inside Qdrant (empty = no filter)
  const fileKinds: string[] = isAll
    ? []
    : [...new Set(fileTypes.flatMap(t => FILE_KIND_MAP[t] ?? []))];

  return { searchForText, searchForImage, fileKinds };
}

/** Build a FormData for a text-query search request */
function makeTextForm(query: string, searchFor: string, fileKinds: string[]): FormData {
  const f = new FormData();
  f.append('text', query);
  f.append('search_for', searchFor);
  fileKinds.forEach(k => f.append('file_kinds', k));
  return f;
}

/**
 * POST /api/search-pc
 * Semantic text search — queries the appropriate embedding spaces based on
 * the selected file type filter, then merges results by normalized score.
 */
export async function searchByText(request: TextSearchRequest): Promise<SearchResponse> {
  const { searchForText, searchForImage, fileKinds } = getSearchConfig(request.fileTypes ?? ['all']);

  const [textResult, imageResult] = await Promise.allSettled([
    searchForText
      ? api.postForm<BackendSearchResponse>('/search-pc', makeTextForm(request.query, 'text', fileKinds))
      : Promise.reject(new Error('skipped')),
    searchForImage
      ? api.postForm<BackendSearchResponse>('/search-pc', makeTextForm(request.query, 'image', fileKinds))
      : Promise.reject(new Error('skipped')),
  ]);

  const textData  = textResult.status  === 'fulfilled' ? textResult.value  : null;
  const imageData = imageResult.status === 'fulfilled' ? imageResult.value : null;

  if (!textData && !imageData) {
    throw new Error('Both text and image search failed');
  }

  // Normalize each group to [0,1] relative to its own max before merging so
  // text-to-text and text-to-image scores are on a comparable scale.
  const normalize = (hits: SearchResult[]) => {
    const max = hits[0]?.confidence ?? 1;
    return max > 0 ? hits.map(r => ({ ...r, confidence: r.confidence / max })) : hits;
  };

  const results = [
    ...normalize((textData?.results  ?? []).map(mapResult)),
    ...normalize((imageData?.results ?? []).map(mapResult)),
  ].sort((a, b) => b.confidence - a.confidence);

  return { results, totalCount: results.length };
}

/**
 * POST /api/search-pc
 * Visual similarity search — sends multipart/form-data with image file.
 */
export async function searchByImage(request: ImageSearchRequest): Promise<SearchResponse> {
  // Image search always uses the CLIP space; file_kinds filter is not meaningful here
  // unless the user has narrowed to a non-image type (in which case return nothing).
  const fileTypes = request.fileTypes ?? ['all'];
  const isAll = fileTypes.includes('all');
  const wantsImages = isAll || fileTypes.includes('image');

  if (!wantsImages) {
    return { results: [], totalCount: 0 };
  }

  const form = new FormData();
  form.append('file', request.image);
  form.append('search_for', 'image');
  // No file_kinds filter for image-query search — CLIP space only contains images anyway

  const data = await api.postForm<BackendSearchResponse>('/search-pc', form);
  const results = (data.results ?? []).map(mapResult);

  return { results, totalCount: results.length };
}
