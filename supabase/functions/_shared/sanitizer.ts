/**
 * Text Sanitization for AI/OCR Inputs
 *
 * Protects against prompt injection and data exfiltration
 */

// Maximum lengths for different content types
export const MAX_LENGTHS = {
  OCR_TEXT: 120000,      // 120KB max OCR text
  PDF_TEXT: 120000,      // 120KB max PDF text
  PROMPT_CONTEXT: 50000, // 50KB max context to LLM
  VENDOR_NAME: 500,
  DESCRIPTION: 2000,
};

// Control characters to remove (keep newlines, tabs)
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Suspicious prompt injection patterns
const INJECTION_PATTERNS = [
  /system:\s*/gi,
  /assistant:\s*/gi,
  /user:\s*/gi,
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
  /disregard\s+(previous|all|above)/gi,
  /forget\s+(previous|all|above)/gi,
  /new\s+instructions?:/gi,
  /override\s+instructions?/gi,
  /<\|.*?\|>/g,  // Special tokens like <|endoftext|>
  /\[\[.*?\]\]/g, // Double bracket patterns
  /```system/gi,
  /\beval\s*\(/gi,
  /\bexec\s*\(/gi,
];

/**
 * Sanitize text before sending to AI/LLM
 */
export function sanitizeForAI(
  text: string | null | undefined,
  maxLength: number = MAX_LENGTHS.PROMPT_CONTEXT
): string {
  if (!text) return '';

  let sanitized = text;

  // Remove control characters
  sanitized = sanitized.replace(CONTROL_CHAR_PATTERN, '');

  // Neutralize injection patterns by adding brackets
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => `[FILTERED: ${match.substring(0, 20)}]`);
  }

  // Remove potential markdown code block exploits
  sanitized = sanitized.replace(/```+/g, '---');

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    // Add truncation marker
    sanitized += '\n[TRUNCATED]';
  }

  return sanitized;
}

/**
 * Sanitize OCR text specifically
 */
export function sanitizeOcrText(text: string | null | undefined): string {
  return sanitizeForAI(text, MAX_LENGTHS.OCR_TEXT);
}

/**
 * Sanitize PDF extracted text
 */
export function sanitizePdfText(text: string | null | undefined): string {
  return sanitizeForAI(text, MAX_LENGTHS.PDF_TEXT);
}

/**
 * Sanitize vendor name
 */
export function sanitizeVendorName(name: string | null | undefined): string | null {
  if (!name) return null;

  let sanitized = name
    .replace(CONTROL_CHAR_PATTERN, '')
    .replace(/[<>{}[\]]/g, '') // Remove potentially dangerous chars
    .trim();

  if (sanitized.length > MAX_LENGTHS.VENDOR_NAME) {
    sanitized = sanitized.substring(0, MAX_LENGTHS.VENDOR_NAME);
  }

  return sanitized || null;
}

/**
 * Sanitize description text
 */
export function sanitizeDescription(text: string | null | undefined): string | null {
  if (!text) return null;

  let sanitized = text
    .replace(CONTROL_CHAR_PATTERN, '')
    .trim();

  if (sanitized.length > MAX_LENGTHS.DESCRIPTION) {
    sanitized = sanitized.substring(0, MAX_LENGTHS.DESCRIPTION);
  }

  return sanitized || null;
}

/**
 * Create safe log message (redact sensitive content)
 */
export function safeLogMessage(
  message: string,
  sensitiveFields: Record<string, unknown>
): string {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(sensitiveFields)) {
    if (value === null || value === undefined) {
      redacted[key] = null;
    } else if (typeof value === 'string') {
      // Show length but not content for strings
      redacted[key] = `[STRING:${value.length}chars]`;
    } else if (typeof value === 'object') {
      redacted[key] = '[OBJECT]';
    } else {
      redacted[key] = '[REDACTED]';
    }
  }

  return `${message} ${JSON.stringify(redacted)}`;
}

/**
 * Check if text contains suspicious injection patterns
 */
export function containsInjectionAttempt(text: string): boolean {
  if (!text) return false;

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
    // Reset regex lastIndex
    pattern.lastIndex = 0;
  }

  return false;
}

/**
 * Validate and clean extraction JSON from AI
 */
export function validateExtractionOutput(
  output: Record<string, unknown>,
  allowedFields: string[]
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in output) {
      const value = output[field];

      // Sanitize string values
      if (typeof value === 'string') {
        cleaned[field] = sanitizeVendorName(value);
      }
      // Validate numbers
      else if (typeof value === 'number') {
        if (isFinite(value) && value >= 0 && value < 1000000000) {
          cleaned[field] = value;
        }
      }
      // Pass through booleans
      else if (typeof value === 'boolean') {
        cleaned[field] = value;
      }
      // Validate nested objects (like confidence scores)
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        cleaned[field] = validateConfidenceScores(value as Record<string, unknown>);
      }
      // Validate arrays (like deductions)
      else if (Array.isArray(value)) {
        cleaned[field] = value.slice(0, 50).map(item => {
          if (typeof item === 'object' && item !== null) {
            return {
              description: sanitizeDescription((item as Record<string, unknown>).description as string),
              amount: typeof (item as Record<string, unknown>).amount === 'number'
                ? (item as Record<string, unknown>).amount
                : null,
            };
          }
          return null;
        }).filter(Boolean);
      }
    }
  }

  return cleaned;
}

/**
 * Validate confidence scores object
 */
function validateConfidenceScores(scores: Record<string, unknown>): Record<string, number> {
  const validated: Record<string, number> = {};

  for (const [key, value] of Object.entries(scores)) {
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      validated[key] = Math.round(value * 100) / 100;
    }
  }

  return validated;
}
