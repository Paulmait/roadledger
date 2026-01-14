import { supabase, getSupabaseUrl } from './client';
import { STORAGE_BUCKETS } from '@/constants';

export type BucketName = keyof typeof STORAGE_BUCKETS;

interface UploadResult {
  path: string;
  publicUrl: string | null;
}

interface SignedUrlResult {
  signedUrl: string;
  path: string;
}

// Generate a storage path for a file
export function generateStoragePath(
  userId: string,
  bucket: BucketName,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${userId}/${timestamp}_${sanitizedFilename}`;
}

// Upload a file to storage
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: Blob | ArrayBuffer,
  contentType: string
): Promise<UploadResult> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) throw error;

  return {
    path: data.path,
    publicUrl: null, // Our buckets are private, use signed URLs
  };
}

// Get a signed URL for downloading a file
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

// Get a signed URL for uploading a file (used by edge function)
export async function getSignedUploadUrl(
  bucket: BucketName,
  path: string
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) throw error;

  return {
    signedUrl: data.signedUrl,
    path: data.path,
  };
}

// Delete a file from storage
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) throw error;
}

// List files in a user's folder
export async function listUserFiles(
  bucket: BucketName,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
): Promise<{ name: string; id: string; created_at: string }[]> {
  const { data, error } = await supabase.storage.from(bucket).list(userId, {
    limit: options?.limit ?? 100,
    offset: options?.offset ?? 0,
    sortBy: options?.sortBy ?? { column: 'created_at', order: 'desc' },
  });

  if (error) throw error;
  return data;
}

// Download a file
export async function downloadFile(
  bucket: BucketName,
  path: string
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) throw error;
  return data;
}

// Call edge function for signed URL (more secure approach)
export async function requestSignedUploadUrl(
  bucket: BucketName,
  filename: string,
  contentType: string
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.functions.invoke('upload-signed-url', {
    body: {
      bucket,
      filename,
      contentType,
    },
  });

  if (error) throw error;
  return data;
}
