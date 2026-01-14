/**
 * Shared validation utilities for Edge Functions
 * Production-hardened with strict input validation
 */

// UUID v4 regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Maximum sizes
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_OCR_TEXT_LENGTH = 50000; // 50KB of text
export const MAX_EXTRACTION_JSON_SIZE = 10000; // 10KB

// Allowed MIME types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export const ALLOWED_DOCUMENT_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
];

/**
 * Validate UUID format
 */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Validate document ID from request
 */
export function validateDocumentId(body: unknown): { valid: true; documentId: string } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { documentId } = body as Record<string, unknown>;

  if (!documentId) {
    return { valid: false, error: 'Missing documentId' };
  }

  if (!isValidUuid(documentId)) {
    return { valid: false, error: 'Invalid documentId format' };
  }

  return { valid: true, documentId };
}

/**
 * Validate MIME type
 */
export function isAllowedMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.some(allowed =>
    mimeType.toLowerCase().startsWith(allowed.toLowerCase())
  );
}

/**
 * Sanitize string for logging (remove sensitive data patterns)
 */
export function sanitizeForLog(value: string, maxLength = 100): string {
  if (!value) return '';

  // Truncate
  let sanitized = value.length > maxLength ? value.substring(0, maxLength) + '...' : value;

  // Redact potential sensitive patterns
  sanitized = sanitized
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]') // Credit cards
    .replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '[SSN]') // SSN
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]') // Auth tokens
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[JWT]'); // JWTs

  return sanitized;
}

/**
 * Create safe error response (never expose internal details)
 */
export function safeErrorResponse(
  publicMessage: string,
  statusCode: number,
  corsHeaders: Record<string, string>,
  internalError?: unknown
): Response {
  // Log internal error without exposing to client
  if (internalError) {
    const errorMsg = internalError instanceof Error ? internalError.message : String(internalError);
    console.error(`[ERROR] ${publicMessage}: ${sanitizeForLog(errorMsg)}`);
  }

  return new Response(
    JSON.stringify({ error: publicMessage }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Validate and cap numeric values
 */
export function validateAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(num) || !isFinite(num)) return null;
  if (num < 0) return null;
  if (num > 999999999) return null; // Cap at ~$1B

  return Math.round(num * 100) / 100; // Round to cents
}

/**
 * Validate date string (YYYY-MM-DD)
 */
export function validateDateString(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(value)) return null;

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  // Reject dates too far in past or future
  const now = new Date();
  const minDate = new Date('2000-01-01');
  const maxDate = new Date(now.getFullYear() + 1, 11, 31);

  if (date < minDate || date > maxDate) return null;

  return value;
}

/**
 * Truncate extraction JSON to safe size
 */
export function truncateExtractionJson(data: unknown): unknown {
  const json = JSON.stringify(data);

  if (json.length <= MAX_EXTRACTION_JSON_SIZE) {
    return data;
  }

  // If too large, return a truncated version with warning
  return {
    _truncated: true,
    _original_size: json.length,
    data: JSON.parse(json.substring(0, MAX_EXTRACTION_JSON_SIZE - 100) + '"}'),
  };
}
