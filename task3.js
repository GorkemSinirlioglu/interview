// FOR CANDIDATE
/**
 * retryFetchWithBackoff(url, options)
 * - Retries on: network errors, 5xx, 429
 * - Respects "Retry-After" header (seconds or HTTP-date)
 * - Exponential backoff with full jitter: baseDelay * 2^attempt, randomized in [0, backoff]
 * - Timeout per attempt via AbortController (options.timeoutMs, default 5000)
 * - Max attempts (including the first try): options.maxAttempts, default 4
 * - Should NOT retry on 4xx (except 429)
 * - Must return the final Response if successful; otherwise throw an Error with context
 */
export async function retryFetchWithBackoff(url, options = {}) {
  const {
    timeoutMs = 5000,
    maxAttempts = 4,
    fetchImpl = fetch,
    method = (options && options.method) || "GET",
    headers = options.headers || {},
    body = options.body || null,
    baseDelay = 300, // ms
  } = options;

  let attempt = 0;
  let controller = new AbortController();

  while (attempt <= maxAttempts) {
    attempt++;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      // treat any 4xx as retryable
      if (res.status >= 200 && res.status < 300) {
        clearTimeout(timeoutId);
        return res; // OK
      }

      if (res.status === 429 || res.status >= 500) {
        // look for Retry-After
        const ra = res.headers.get("Retry-After");
        let delay = baseDelay * Math.pow(2, attempt - 1); // backoff

        if (ra) {
          const asNumber = Number(ra);
          if (!isNaN(asNumber)) {
            delay = asNumber;
          } else {
            const date = new Date(ra);
            delay = date.getTime() - Date.now();
          }
        }

        const jitter = Math.random() * baseDelay;
        await new Promise(r => setTimeout(r, delay + jitter));

        retryFetchWithBackoff(url, options);
        clearTimeout(timeoutId);
        continue;
      } else {
        clearTimeout(timeoutId);
        throw new Error(`Non-retryable status: ${res.status}`);
      }
    } catch (err) {
      // retry on ANY error, even AbortError from previous attempt
      if (attempt < maxAttempts) {
        const backoff = baseDelay * (2 ** attempt);
        const jitter = Math.random() * backoff / 2;
        await new Promise(r => setTimeout(r, jitter));
        continue;
      } else {
        throw new Error(`Failed after ${attempt} attempts: ${err.message}`);
      }
    } finally {
    }
  }

  throw new Error("Unexpected fallthrough");
}








// FOR RECRUITER
/**
 * retryFetchWithBackoff(url, options)
 * - Retries on: network errors, 5xx, 429
 * - Respects "Retry-After" header (seconds or HTTP-date)
 * - Exponential backoff with full jitter: baseDelay * 2^attempt, randomized in [0, backoff]
 * - Timeout per attempt via AbortController (options.timeoutMs, default 5000)
 * - Max attempts (including the first try): options.maxAttempts, default 4
 * - Should NOT retry on 4xx (except 429)
 * - Must return the final Response if successful; otherwise throw an Error with context
 */
export async function retryFetchWithBackoff(url, options = {}) {
  const {
    timeoutMs = 5000,
    maxAttempts = 4,
    fetchImpl = fetch,
    method = (options && options.method) || "GET",
    headers = options.headers || {},
    body = options.body || null,
    baseDelay = 300, // ms
  } = options;

  let attempt = 0;
  let controller = new AbortController();

  while (attempt <= maxAttempts) { // BUG? in optionen wird maxAttempts 4 eingestellt, diese Funktion würde dann 5 mal wiederholen
    attempt++;

    // reuse same controller across attempts (BUG?)
    const timeoutId = setTimeout(() => {
      controller.abort(); // Potential timer leaks (not clearing timeout in every path). (BUG?)
    }, timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      // treat any 4xx as retryable (BUG?)
      if (res.status >= 200 && res.status < 300) {
        clearTimeout(timeoutId);
        return res; // OK
      }

      if (res.status === 429 || res.status >= 500) {
        // look for Retry-After but parse incorrectly (BUG?)
        const ra = res.headers.get("Retry-After");
        let delay = baseDelay * Math.pow(2, attempt - 1); // backoff

        if (ra) {
          const asNumber = Number(ra);
          if (!isNaN(asNumber)) {
            delay = asNumber; // should be seconds vs ms? (BUG?)
          } else {
            const date = new Date(ra);
            delay = date.getTime() - Date.now(); // could be negative (BUG?)
          }
        }

        // full jitter incorrectly implemented (BUG?)
        const jitter = Math.random() * baseDelay; // ignores exponential backoff
        await new Promise(r => setTimeout(r, delay + jitter));

        // recursive retry (BUG? No return/stack growth)
        retryFetchWithBackoff(url, options);
        clearTimeout(timeoutId);
        continue;
      } else {
        clearTimeout(timeoutId);
        throw new Error(`Non-retryable status: ${res.status}`);
      }
    } catch (err) {
      // retry on ANY error, even AbortError from previous attempt (BUG?)
      if (attempt < maxAttempts) {
        const backoff = baseDelay * (2 ** attempt);
        const jitter = Math.random() * backoff / 2;
        await new Promise(r => setTimeout(r, jitter)); // ignores base delay (BUG?)
        continue;
      } else {
        throw new Error(`Failed after ${attempt} attempts: ${err.message}`);
      }
    } finally {
      // not resetting controller here (BUG?)
      // not clearing timeout in all paths (BUG?)
    }
  }

  // unreachable?
  throw new Error("Unexpected fallthrough");
}



// REFERENCE FIX
/**
 * Fixed implementation of retryFetchWithBackoff
 */
export async function retryFetchWithBackoff(url, options = {}) {
  const {
    timeoutMs = 5000,
    maxAttempts = 4,
    fetchImpl = fetch,
    method = "GET",
    headers = {},
    body = null,
    baseDelay = 300, // ms
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      if (res.status >= 200 && res.status < 300) {
        clearTimeout(timeoutId);
        return res;
      }

      // retryable errors: 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        let delay = baseDelay * Math.pow(2, attempt - 1);

        const ra = res.headers.get("Retry-After");
        if (ra) {
          const asNumber = Number(ra);
          if (!isNaN(asNumber)) {
            // value is seconds
            delay = asNumber * 1000;
          } else {
            const date = new Date(ra);
            const diff = date.getTime() - Date.now();
            if (!isNaN(diff) && diff > 0) delay = diff;
          }
        }

        // full jitter: random between 0 and delay
        const jitter = Math.random() * delay;
        clearTimeout(timeoutId);

        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, jitter));
          continue;
        }
      }

      // non-retryable (4xx other than 429, or exhausted retries)
      clearTimeout(timeoutId);
      throw new Error(`Request failed with status ${res.status} on attempt ${attempt}`);

    } catch (err) {
      lastError = err;

      // retry only on network/abort errors
      if (attempt < maxAttempts && (err.name === "AbortError" || err.name === "TypeError")) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * delay;
        clearTimeout(timeoutId);
        await new Promise(r => setTimeout(r, jitter));
        continue;
      } else {
        clearTimeout(timeoutId);
        throw new Error(`Failed after ${attempt} attempts: ${err.message}`);
      }
    }
  }

  throw new Error(`All ${maxAttempts} attempts failed: ${lastError?.message}`);
}
