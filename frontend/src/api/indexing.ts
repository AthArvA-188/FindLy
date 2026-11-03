import { api } from './client';

interface IndexSummary {
  total_indexed: number;
  total_skipped: number;
  total_failed: number;
}

export interface IndexResponse {
  status: string;
  summary: IndexSummary;
  indexed: { file_path: string; hash: string; kind: string }[];
  skipped: { file_path: string; reason: string }[];
  failed: { file_path: string; error: string }[];
}

interface ReindexSummary {
  total_requested: number;
  total_reindexed: number;
  total_failed: number;
}

export interface ReindexResponse {
  status: string;
  summary: ReindexSummary;
  reindexed: { file_path: string; hash: string; kind: string }[];
  failed: { file_path: string; error: string }[];
}

export interface IndexJobStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  paths?: string[];
}

// Client-side job tracker (backend indexing is synchronous)
const jobs = new Map<string, IndexJobStatus>();

/**
 * POST /api/index-files
 * Index specific files by path (synchronous)
 */
export async function indexFiles(filePaths: string[]): Promise<IndexResponse> {
  return await api.post<IndexResponse>('/index-files', { file_paths: filePaths });
}

/**
 * POST /api/index-directories
 * Recursively index all files in directories (synchronous)
 */
export async function indexDirectories(directoryPaths: string[]): Promise<IndexResponse> {
  return await api.post<IndexResponse>('/index-directories', { directory_paths: directoryPaths });
}

/**
 * Start indexing paths (files or directories) and return a client-side job ID.
 * Polls via getIndexStatus().
 */
export async function indexPaths(paths: string[]): Promise<{ job_id: string }> {
  const jobId = crypto.randomUUID();
  const job: IndexJobStatus = { status: 'queued', progress: 0, paths };
  jobs.set(jobId, job);

  (async () => {
    job.status = 'processing';
    try {
      // Route files and directories to their respective endpoints
      const filePaths = paths.filter(p => /\.[^/\\]+$/.test(p));
      const dirPaths  = paths.filter(p => !/\.[^/\\]+$/.test(p));

      await Promise.all([
        filePaths.length > 0
          ? api.post<IndexResponse>('/index-files', { file_paths: filePaths })
          : Promise.resolve(),
        dirPaths.length > 0
          ? api.post<IndexResponse>('/index-directories', { directory_paths: dirPaths })
          : Promise.resolve(),
      ]);

      job.status = 'completed';
      job.progress = 100;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'Indexing failed';
    }
  })();

  return { job_id: jobId };
}

/**
 * POST /api/reindex-files
 * Force re-index specific files (ignores Redis hash dedup). Synchronous.
 */
export async function reindexFiles(filePaths: string[]): Promise<ReindexResponse> {
  return await api.post<ReindexResponse>('/reindex-files', { file_paths: filePaths });
}

/**
 * Start re-indexing files and return a client-side job ID.
 * Only accepts file paths — the backend has no /api/reindex-directories.
 * Polls via getIndexStatus(), so the existing IndexingProgress UI works unchanged.
 */
export async function reindexPaths(filePaths: string[]): Promise<{ job_id: string }> {
  const jobId = crypto.randomUUID();
  const job: IndexJobStatus = { status: 'queued', progress: 0, paths: filePaths };
  jobs.set(jobId, job);

  (async () => {
    job.status = 'processing';
    try {
      await api.post<ReindexResponse>('/reindex-files', { file_paths: filePaths });
      job.status = 'completed';
      job.progress = 100;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'Re-indexing failed';
    }
  })();

  return { job_id: jobId };
}

/**
 * Get the status of a client-side indexing job.
 */
export async function getIndexStatus(jobId: string): Promise<IndexJobStatus> {
  return jobs.get(jobId) ?? { status: 'failed', progress: 0, error: 'Job not found' };
}

/**
 * Remove indexed paths (no backend endpoint; removal is handled client-side).
 */
export async function deleteIndexing(_paths: string[]): Promise<void> {
  // no-op: the backend has no delete-by-path endpoint
}

/**
 * POST /api/reset-all
 * Reset Qdrant collection, Redis, and indexed files database
 */
export async function resetAll(): Promise<{ status: string; message: string }> {
  return await api.post('/reset-all');
}
