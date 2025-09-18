import retry from 'async-retry';

/**
 * Exponential backoff with jitter for Auth0 API calls
 * Respects X-RateLimit-Reset header when available
 */
export async function retryWithBackoff(fn, options = {}) {
  const defaultOptions = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
    randomize: true, // Add jitter
    onRetry: (error, attempt) => {
      console.warn(`Retry attempt ${attempt} for Auth0 API call:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        rateLimitReset: error.response?.headers['x-ratelimit-reset'],
      });
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  return retry(async (bail, attempt) => {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 429) {
        bail(error);
        return;
      }

      // For 429 errors, respect X-RateLimit-Reset header if available
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        if (resetTime) {
          const resetTimestamp = parseInt(resetTime) * 1000;
          const waitTime = Math.max(0, resetTimestamp - Date.now());
          
          if (waitTime > 0 && waitTime < 60000) { // Don't wait more than 1 minute
            console.warn(`Rate limited. Waiting ${waitTime}ms until reset time.`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      // Retry on 5xx errors and 429
      if (error.response?.status >= 500 || error.response?.status === 429) {
        throw error;
      }

      // Don't retry other errors
      bail(error);
    }
  }, mergedOptions);
}

/**
 * Create a delay with jitter
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} jitterFactor - Jitter factor (0-1)
 * @returns {number} - Delay with jitter applied
 */
export function addJitter(baseDelay, jitterFactor = 0.1) {
  const jitter = Math.random() * jitterFactor * baseDelay;
  return baseDelay + jitter;
}