/**
 * AI Provider Abstraction with Fallback Support
 * Supports OpenAI (primary) and Anthropic (fallback)
 *
 * Ralph says: "I'm helping!" - but only in code comments ;)
 */

export interface AIExtractionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  provider: 'openai' | 'anthropic';
  elapsed_ms: number;
}

interface ProviderHealth {
  failures: number;
  lastFailure: number;
  circuitOpen: boolean;
}

// Circuit breaker state (in-memory, resets on cold start)
const providerHealth: Record<string, ProviderHealth> = {
  openai: { failures: 0, lastFailure: 0, circuitOpen: false },
  anthropic: { failures: 0, lastFailure: 0, circuitOpen: false },
};

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a provider's circuit breaker is open
 */
function isCircuitOpen(provider: 'openai' | 'anthropic'): boolean {
  const health = providerHealth[provider];

  // Reset circuit if enough time has passed
  if (health.circuitOpen && Date.now() - health.lastFailure > CIRCUIT_RESET_MS) {
    health.circuitOpen = false;
    health.failures = 0;
  }

  return health.circuitOpen;
}

/**
 * Record a provider failure
 */
function recordFailure(provider: 'openai' | 'anthropic'): void {
  const health = providerHealth[provider];
  health.failures++;
  health.lastFailure = Date.now();

  if (health.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    health.circuitOpen = true;
    console.warn(`[CIRCUIT] ${provider} circuit opened after ${health.failures} failures`);
  }
}

/**
 * Record a provider success (reset failure count)
 */
function recordSuccess(provider: 'openai' | 'anthropic'): void {
  const health = providerHealth[provider];
  health.failures = 0;
  health.circuitOpen = false;
}

/**
 * Call OpenAI GPT-4 Vision API
 */
async function callOpenAI(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  contentType: string
): Promise<AIExtractionResult> {
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${contentType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    const elapsed_ms = Date.now() - startTime;

    if (!response.ok) {
      const status = response.status;
      // Don't retry on 4xx errors (client errors)
      if (status >= 400 && status < 500) {
        return {
          success: false,
          error: `OpenAI returned ${status}`,
          provider: 'openai',
          elapsed_ms,
        };
      }
      throw new Error(`OpenAI API error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsed = JSON.parse(content);
    recordSuccess('openai');

    return {
      success: true,
      data: parsed,
      provider: 'openai',
      elapsed_ms,
    };
  } catch (error) {
    recordFailure('openai');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OpenAI call failed',
      provider: 'openai',
      elapsed_ms: Date.now() - startTime,
    };
  }
}

/**
 * Call Anthropic Claude API (fallback)
 */
async function callAnthropic(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  contentType: string
): Promise<AIExtractionResult> {
  const startTime = Date.now();

  try {
    // Map common image types to Anthropic's accepted formats
    let mediaType = contentType;
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: prompt + '\n\nRespond with valid JSON only.',
              },
            ],
          },
        ],
      }),
    });

    const elapsed_ms = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No content in Anthropic response');
    }

    // Extract JSON from response (Claude may include markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    recordSuccess('anthropic');

    return {
      success: true,
      data: parsed,
      provider: 'anthropic',
      elapsed_ms,
    };
  } catch (error) {
    recordFailure('anthropic');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Anthropic call failed',
      provider: 'anthropic',
      elapsed_ms: Date.now() - startTime,
    };
  }
}

/**
 * Extract data from image with fallback between providers
 */
export async function extractWithFallback(
  prompt: string,
  imageBase64: string,
  contentType: string
): Promise<AIExtractionResult> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  // Determine provider order based on circuit breaker state
  const providers: Array<{
    name: 'openai' | 'anthropic';
    key: string | undefined;
    call: typeof callOpenAI;
  }> = [];

  // Add OpenAI if not circuit-broken and has key
  if (openaiKey && !isCircuitOpen('openai')) {
    providers.push({ name: 'openai', key: openaiKey, call: callOpenAI });
  }

  // Add Anthropic if not circuit-broken and has key
  if (anthropicKey && !isCircuitOpen('anthropic')) {
    providers.push({ name: 'anthropic', key: anthropicKey, call: callAnthropic });
  }

  // If both circuits open, try OpenAI anyway (half-open)
  if (providers.length === 0 && openaiKey) {
    providers.push({ name: 'openai', key: openaiKey, call: callOpenAI });
  }

  if (providers.length === 0) {
    return {
      success: false,
      error: 'No AI providers configured',
      provider: 'openai',
      elapsed_ms: 0,
    };
  }

  // Try each provider in order
  for (const provider of providers) {
    const result = await provider.call(provider.key!, prompt, imageBase64, contentType);

    if (result.success) {
      return result;
    }

    console.warn(`[AI] ${provider.name} failed: ${result.error}`);

    // Continue to next provider
  }

  // All providers failed
  return {
    success: false,
    error: 'All AI providers failed',
    provider: providers[providers.length - 1]?.name || 'openai',
    elapsed_ms: 0,
  };
}
