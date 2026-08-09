const defaultNotionHosts = Object.freeze([
  "app.notion.com",
  "www.notion.so",
]);

function isNotionHostname(hostname) {
  return ["notion.com", "notion.so"].some(
    (rootHost) => hostname === rootHost || hostname.endsWith(`.${rootHost}`),
  );
}

function normalizeAdditionalHost(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue);
    const url = new URL(hasScheme ? trimmedValue : `https://${trimmedValue}`);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !isNotionHostname(url.hostname)
    ) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

function normalizeAdditionalHosts(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalizedHosts = [];
  const seenHosts = new Set();
  for (const value of values) {
    const hostname = normalizeAdditionalHost(value);
    if (!hostname || seenHosts.has(hostname)) {
      continue;
    }

    seenHosts.add(hostname);
    normalizedHosts.push(hostname);
  }
  return normalizedHosts;
}

var notionHostPolicy = Object.freeze({
  defaultHosts: defaultNotionHosts,
  isNotionHostname,
  normalizeAdditionalHost,
  normalizeAdditionalHosts,
});
