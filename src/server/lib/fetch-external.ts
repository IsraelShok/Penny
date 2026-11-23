import "server-only";

/**
 * fetch for hosts outside this machine's control (quotes, exchange rates, public data, a model
 * server): always with a deadline, so a host that accepts the connection and then says nothing
 * cannot hold a request or a background job open. The deadline covers reading the body too.
 * A caller's own signal still aborts it.
 */
export function fetchExternal(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const deadline = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
  });
}
