import { generateText as geminiGenerateText } from './geminiService';

export interface AIRequestOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  featureArea?: string;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface AIRequestResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  fallbackUsed: boolean;
}

const DEFAULT_OPTIONS: AIRequestOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  // Heavy calls route through the background function (up to a 5-min client poll
  // in geminiService). Sync calls self-abort at 28s regardless, so this only
  // governs the background path.
  timeoutMs: 300000
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, baseDelay: number): number {
  const jitter = Math.random() * 500;
  return Math.min(baseDelay * Math.pow(2, attempt - 1) + jitter, 30000);
}

export async function makeAIRequest<T>(
  prompt: string,
  parseResponse: (response: string) => T,
  fallbackValue: T,
  options: AIRequestOptions = {}
): Promise<AIRequestResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= (opts.maxRetries || 3); attempt++) {
    attempts = attempt;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

      const response = await Promise.race([
        geminiGenerateText(prompt, opts.featureArea),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), opts.timeoutMs);
        })
      ]);

      clearTimeout(timeoutId);

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from AI service');
      }

      const parsed = parseResponse(response);

      return {
        success: true,
        data: parsed,
        attempts,
        fallbackUsed: false
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      console.warn(`AI request attempt ${attempt} failed:`, lastError.message);

      if (opts.onRetry && attempt < (opts.maxRetries || 3)) {
        opts.onRetry(attempt, lastError);
      }

      if (attempt < (opts.maxRetries || 3)) {
        const delay = calculateBackoff(attempt, opts.retryDelayMs || 1000);
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
      }
    }
  }

  console.error(`All ${attempts} AI request attempts failed. Using fallback.`);

  return {
    success: false,
    data: fallbackValue,
    error: lastError?.message || 'Unknown error',
    attempts,
    fallbackUsed: true
  };
}

export function parseJSONArray<T>(response: string, validator?: (item: unknown) => item is T): T[] {
  // Try to extract JSON array — attempt progressively less strict methods
  let parsed: any[] | null = null;

  // Method 1: Find the outermost balanced JSON array by bracket counting
  const startIdx = response.indexOf('[');
  if (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = startIdx; i < response.length; i++) {
      const ch = response[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[') depth++;
      if (ch === ']') { depth--; if (depth === 0) { endIdx = i; break; } }
    }

    if (endIdx !== -1) {
      let jsonStr = response.substring(startIdx, endIdx + 1);
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        // Try repairing truncated JSON
        if (!isJSONComplete(jsonStr)) {
          jsonStr = repairTruncatedJSON(jsonStr);
        }
        try { parsed = JSON.parse(jsonStr); } catch { /* fall through */ }
      }
    }
  }

  // Method 2: Fallback — greedy regex with repair
  if (!parsed) {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    let jsonStr = jsonMatch[0];
    if (!isJSONComplete(jsonStr)) jsonStr = repairTruncatedJSON(jsonStr);
    parsed = JSON.parse(jsonStr);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Parsed result is not an array');
  }

  if (validator) {
    const valid = parsed.filter(validator);
    const invalid = parsed.length - valid.length;
    if (invalid > 0) {
      console.warn(`${invalid} of ${parsed.length} items failed validation`);
    }
    return valid;
  }

  return parsed;
}

export function parseJSONObject<T>(response: string): T {
  const jsonMatch = response.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON object found in response');
  }

  let jsonStr = jsonMatch[0];

  if (!isJSONComplete(jsonStr)) {
    jsonStr = repairTruncatedJSON(jsonStr);
  }

  return JSON.parse(jsonStr);
}

function isJSONComplete(jsonString: string): boolean {
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }

  return braceCount === 0 && bracketCount === 0 && !inString;
}

function repairTruncatedJSON(jsonString: string): string {
  let repaired = jsonString.trim();

  if (repaired.endsWith(',')) {
    repaired = repaired.slice(0, -1);
  }

  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
  }

  if (inString) {
    repaired += '"';
  }

  while (braceCount > 0) {
    repaired += '}';
    braceCount--;
  }

  while (bracketCount > 0) {
    repaired += ']';
    bracketCount--;
  }

  return repaired;
}

export function createUserFriendlyError(
  operation: string,
  technicalError: string,
  suggestion?: string
): string {
  const errorMessages: Record<string, { message: string; suggestion: string }> = {
    'Request timeout': {
      message: 'The AI service took too long to respond',
      suggestion: 'Try again in a few moments. If the issue persists, try generating smaller sections individually.'
    },
    'Empty response': {
      message: 'The AI service returned an empty response',
      suggestion: 'Try regenerating. If the issue persists, check your invention description for clarity.'
    },
    'No JSON array found': {
      message: 'The AI response was not in the expected format',
      suggestion: 'Try regenerating. The AI may have produced an incomplete response.'
    },
    'No JSON object found': {
      message: 'The AI response was not in the expected format',
      suggestion: 'Try regenerating. The AI may have produced an incomplete response.'
    },
    'rate limit': {
      message: 'Too many requests to the AI service',
      suggestion: 'Please wait a minute before trying again.'
    },
    'network': {
      message: 'Network connection issue',
      suggestion: 'Check your internet connection and try again.'
    }
  };

  const lowerError = technicalError.toLowerCase();

  for (const [key, value] of Object.entries(errorMessages)) {
    if (lowerError.includes(key.toLowerCase())) {
      return `${operation} failed: ${value.message}. ${suggestion || value.suggestion}`;
    }
  }

  return `${operation} failed: ${suggestion || 'Please try again. If the issue persists, try simplifying your input or generating sections individually.'}`;
}

export interface GenerationProgress {
  step: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message?: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

export function createProgressTracker(steps: string[]): {
  current: number;
  update: (stepIndex: number, status: GenerationProgress['status'], message?: string) => GenerationProgress;
  getOverallProgress: () => number;
} {
  let current = 0;

  return {
    get current() { return current; },
    update(stepIndex: number, status: GenerationProgress['status'], message?: string): GenerationProgress {
      current = stepIndex;
      return {
        step: steps[stepIndex] || 'Unknown step',
        progress: Math.round(((stepIndex + (status === 'completed' ? 1 : 0.5)) / steps.length) * 100),
        status,
        message
      };
    },
    getOverallProgress(): number {
      return Math.round((current / steps.length) * 100);
    }
  };
}
