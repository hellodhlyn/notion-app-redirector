const supportedNotionHosts = new Set(["app.notion.com"]);

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

function parseSupportedUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !supportedNotionHosts.has(url.hostname)) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function shouldRedirectToApp(rawUrl, additionalExcludedPathPatterns = []) {
  const url = parseSupportedUrl(rawUrl);
  if (!url || url.pathname === "/") {
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
  const url = parseSupportedUrl(rawUrl);
  if (!url) {
    throw new TypeError("Unsupported Notion URL");
  }

  return url.href.replace(/^https:/, "notion:");
}

var notionUrlPolicy = Object.freeze({
  shouldRedirectToApp,
  toAppUrl,
});
