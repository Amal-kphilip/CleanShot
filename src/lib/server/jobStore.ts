import crypto from 'crypto';
import { StripResult, ParsedMetadata, StripOptions } from '../engine/types';

export interface StoredFile {
  fileId: string;
  originalFilename: string;
  cleanedFilename: string;
  mimeType: string;
  originalBuffer: Uint8Array;
  cleanedBuffer: Uint8Array;
  stripResult: StripResult;
  metadata?: ParsedMetadata;
  createdAt: number;
}

export interface StoredJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  totalFiles: number;
  completedFiles: number;
  files: Map<string, StoredFile>;
  options: StripOptions;
  createdAt: number;
  expiresAt: number;
  error?: string;
}

// Global in-memory job cache (15 min TTL with auto-prune)
const JOB_TTL_MS = 15 * 60 * 1000;
const jobs = new Map<string, StoredJob>();

// Periodic cleanup of expired jobs
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [jobId, job] of jobs.entries()) {
      if (now > job.expiresAt) {
        jobs.delete(jobId);
      }
    }
  }, 60 * 1000);
}

export function createJob(options: StripOptions = {}): StoredJob {
  const jobId = crypto.randomUUID();
  const now = Date.now();
  const job: StoredJob = {
    jobId,
    status: 'pending',
    totalFiles: 0,
    completedFiles: 0,
    files: new Map(),
    options,
    createdAt: now,
    expiresAt: now + JOB_TTL_MS,
  };
  jobs.set(jobId, job);
  return job;
}

export function getJob(jobId: string): StoredJob | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  if (Date.now() > job.expiresAt) {
    jobs.delete(jobId);
    return undefined;
  }
  return job;
}

export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId);
}

export function addFileToJob(jobId: string, file: StoredFile): boolean {
  const job = getJob(jobId);
  if (!job) return false;
  job.files.set(file.fileId, file);
  job.completedFiles = job.files.size;
  if (job.completedFiles >= job.totalFiles) {
    job.status = 'completed';
  }
  return true;
}
