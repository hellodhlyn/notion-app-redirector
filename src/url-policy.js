const defaultNotionHostSet = new Set(notionHostPolicy.defaultHosts);

function pathPatternToRegExp(pattern) {
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*+/g, ".*");
  return new RegExp(`^${source}$`);
}

const notionExcludedPathMatchers = notionAasaExcludedPathPatterns.map(
  pathPatternToRegExp,
);

function additionalPathMatchers(pathPatterns) {
  if (!Array.isArray(pathPatterns)) {
    return [];
  }

  return pathPatterns
    .filter(
      (pattern) =>
        typeof pattern === "string" && pattern.startsWith("/"),
    )
    .map(pathPatternToRegExp);
}

function parseNotionUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      !notionHostPolicy.isNotionHostname(url.hostname)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function shouldRedirectToApp(
  rawUrl,
  additionalExcludedPathPatterns = [],
  additionalAllowedHosts = [],
) {
  const url = parseNotionUrl(rawUrl);
  const allowedHosts = new Set([
    ...defaultNotionHostSet,
    ...notionHostPolicy.normalizeAdditionalHosts(additionalAllowedHosts),
  ]);
  if (!url || !allowedHosts.has(url.hostname) || url.pathname === "/") {
    return false;
  }

  if (notionExcludedPathMatchers.some((matcher) => matcher.test(url.pathname))) {
    return false;
  }

  return !additionalPathMatchers(additionalExcludedPathPatterns).some((matcher) =>
    matcher.test(url.pathname),
  );
}

function toAppUrl(rawUrl) {
  const url = parseNotionUrl(rawUrl);
  if (!url) {
    throw new TypeError("Unsupported Notion URL");
  }

  return url.href.replace(/^https:/, "notion:");
}

var notionUrlPolicy = Object.freeze({
  shouldRedirectToApp,
  toAppUrl,
});
