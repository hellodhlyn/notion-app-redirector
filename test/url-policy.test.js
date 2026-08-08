const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = vm.createContext({ URL });
for (const relativePath of [
  "src/notion-aasa-exclusions.js",
  "src/url-policy.js",
]) {
  const source = fs.readFileSync(path.resolve(relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const { shouldRedirectToApp, toAppUrl } = context.notionUrlPolicy;
const { pathPatternToRegExp } = context;
const pageId = "0123456789abcdef0123456789abcdef";

test("redirects canonical document paths on app.notion.com", () => {
  assert.equal(
    shouldRedirectToApp(
      `https://app.notion.com/p/${pageId}?pvs=4`,
    ),
    true,
  );
});

test("rejects unsupported hosts and protocols", () => {
  assert.equal(shouldRedirectToApp(`https://notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`https://www.notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`https://file.notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`https://www.notion.com/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`http://www.notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp("not a url"), false);
});

test("keeps the root and AASA-excluded paths in the browser", () => {
  for (const path of [
    "/",
    "/help",
    "/help/getting-started",
    "/login",
    "/oauth2/authorize",
    "/profile/settings",
    "/desktop/whats-new",
  ]) {
    assert.equal(shouldRedirectToApp(`https://app.notion.com${path}`), false, path);
  }
});

test("matches AASA path patterns without prefix overmatching", () => {
  assert.equal(
    shouldRedirectToApp(`https://app.notion.com/helpful-workspace-${pageId}`),
    true,
  );
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/team/acme/join/invite-token"),
    false,
  );
});

test("matches configured exact and wildcard path patterns", () => {
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/specific-page", [
      "/specific-page",
    ]),
    false,
  );
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/private/project/page", [
      "/private/*",
    ]),
    false,
  );
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/public/project/page", [
      "/private/*",
    ]),
    true,
  );
});

test("normalizes consecutive wildcards without changing their matching behavior", () => {
  const consecutiveStarPattern = ["/a/******/b"];
  const singleStarPattern = ["/a/*/b"];
  const matchingUrl = "https://app.notion.com/a/one/two/b";
  const nonMatchingUrl = `https://app.notion.com/a/${"x".repeat(80)}/c`;

  assert.equal(
    pathPatternToRegExp(consecutiveStarPattern[0]).source,
    pathPatternToRegExp(singleStarPattern[0]).source,
  );
  assert.equal(
    shouldRedirectToApp(matchingUrl, consecutiveStarPattern),
    shouldRedirectToApp(matchingUrl, singleStarPattern),
  );
  assert.equal(
    shouldRedirectToApp(nonMatchingUrl, consecutiveStarPattern),
    shouldRedirectToApp(nonMatchingUrl, singleStarPattern),
  );
  assert.equal(
    shouldRedirectToApp(nonMatchingUrl, consecutiveStarPattern),
    true,
  );
});

test("matches configured patterns against pathname without query or fragment", () => {
  assert.equal(
    shouldRedirectToApp(
      "https://app.notion.com/custom/team/acme/page?view=compact#details",
      ["/custom/team/acme/*"],
    ),
    false,
  );
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/custom/team/acme", [
      "/custom/team/acme/*",
    ]),
    true,
  );
});

test("treats question marks in configured patterns as literals", () => {
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/custom/literalpage", [
      "/custom/literal?page",
    ]),
    true,
  );
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/custom/literal%3Fpage", [
      "/custom/literal%3Fpage",
    ]),
    false,
  );
});

test("always applies AASA exclusions alongside configured patterns", () => {
  assert.equal(
    shouldRedirectToApp("https://app.notion.com/help", ["/help"]),
    false,
  );
});

test("creates a Notion scheme URL without losing query or fragment", () => {
  assert.equal(
    toAppUrl(`https://app.notion.com/p/${pageId}?pvs=4#section`),
    `notion://app.notion.com/p/${pageId}?pvs=4#section`,
  );
  assert.throws(() => toAppUrl(`https://file.notion.so/${pageId}`), {
    name: "TypeError",
  });
});
