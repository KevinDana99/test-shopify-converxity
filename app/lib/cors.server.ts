const DEFAULT_ALLOWED_HEADERS = [
  "Accept",
  "Content-Type",
  "Origin",
  "X-Shopify-Shop-Domain",
].join(", ");

function toAllowedOriginsList(allowedOrigins: string) {
  return allowedOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string) {
  if (!origin) {
    return true;
  }

  const allowedList = toAllowedOriginsList(allowedOrigins);

  if (allowedList.length === 0 || allowedList.includes("*")) {
    return true;
  }

  return allowedList.includes(origin);
}

export function buildCorsHeaders(request: Request, allowedOrigins: string) {
  const origin = request.headers.get("Origin");
  const headers = new Headers();

  headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS);
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin && allowedOrigins.includes("*")) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.includes("*")) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}
