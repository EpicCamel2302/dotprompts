/**
 * Fetch wrapper that retries 429 rate limits exactly 3 times,
 * backing off exponentially between retries.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);

    if (response.status !== 429 || attempt >= 3) {
      return response;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 200 * 2 ** attempt),
    );
  }
}