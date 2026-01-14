/**
 * CORS and Security Headers Configuration
 *
 * Production-hardened CORS and security headers for Edge Functions
 */

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  // Production
  'https://roadledger.app',
  'https://www.roadledger.app',
  'https://app.roadledger.app',
  // Expo development
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:19000',
  // Expo Go on local network
  'exp://localhost:8081',
  // Allow null origin for Expo native apps
  null,
];

// Check if origin is allowed
function isOriginAllowed(origin: string | null): boolean {
  // Allow requests from Expo native apps (no origin)
  if (origin === null || origin === 'null') {
    return true;
  }

  // Allow configured origins
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Allow Expo development URLs (exp:// and various localhost)
  if (origin.startsWith('exp://') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.match(/^http:\/\/localhost:\d+$/)) {
    return true;
  }

  return false;
}

// Standard security headers
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-XSS-Protection': '1; mode=block',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Get CORS headers for a request
export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'Access-Control-Max-Age': '86400', // 24 hours
    ...SECURITY_HEADERS,
  };

  if (isOriginAllowed(origin)) {
    // Set specific origin or * for mobile apps
    headers['Access-Control-Allow-Origin'] = origin || '*';
  } else {
    // Blocked origin - don't set Allow-Origin header
    // The browser will reject the request
    console.warn(`[CORS] Blocked origin: ${origin}`);
  }

  return headers;
}

// Get headers for sensitive responses (add cache control)
export function getSensitiveResponseHeaders(origin: string | null): Record<string, string> {
  return {
    ...getCorsHeaders(origin),
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
  };
}

// Handle CORS preflight
export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') {
    return null;
  }

  const origin = req.headers.get('Origin');
  const headers = getCorsHeaders(origin);

  // Check if origin is allowed for preflight
  if (!headers['Access-Control-Allow-Origin']) {
    return new Response('Forbidden', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

// Create JSON response with security headers
export function secureJsonResponse(
  data: unknown,
  status: number,
  origin: string | null,
  sensitive: boolean = true
): Response {
  const headers = sensitive
    ? getSensitiveResponseHeaders(origin)
    : getCorsHeaders(origin);

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

// Create error response with security headers
export function secureErrorResponse(
  error: string,
  status: number,
  origin: string | null,
  requestId?: string
): Response {
  const body: Record<string, unknown> = {
    ok: false,
    error: {
      code: getErrorCode(status),
      message: error,
    },
  };

  if (requestId) {
    body.error = { ...(body.error as object), request_id: requestId };
  }

  return secureJsonResponse(body, status, origin);
}

// Map status code to error code
function getErrorCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
  };
  return codes[status] || 'UNKNOWN_ERROR';
}
