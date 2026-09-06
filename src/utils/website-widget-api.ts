export function websiteWidgetUrl(
  apiBaseUrl: string | undefined,
  widgetId: string,
  hostname: string | undefined,
  operation: "config" | "session"
) {
  if (!apiBaseUrl || !hostname || !widgetId.trim()) {
    throw new Error("The website widget is not configured.");
  }
  const base = new URL(apiBaseUrl);
  const local =
    base.hostname === "localhost" ||
    base.hostname === "127.0.0.1" ||
    base.hostname === "[::1]" ||
    base.hostname.endsWith(".localhost");
  if (
    (base.protocol !== "https:" && !(local && base.protocol === "http:")) ||
    base.username ||
    base.password
  ) {
    throw new Error("The website widget endpoint is invalid.");
  }
  const url = new URL(
    `${base.pathname.replace(/\/$/, "")}/website-widgets/${encodeURIComponent(widgetId)}/${operation}`,
    base.origin
  );
  url.searchParams.set("hostname", hostname);
  return url.toString();
}
