/**
 * Logs a message with ISO timestamp prefix
 */
export function log(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

/**
 * Logs an error message with ISO timestamp prefix
 */
export function logError(...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR:`, ...args);
}

/**
 * Parses JSON body from request
 */
export async function parseBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Returns JSON response with proper headers
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

