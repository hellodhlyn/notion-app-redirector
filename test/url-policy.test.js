const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = vm.createContext({ URL });
for (const relativePath of [
  "src/notion-hosts.js",
  "src/notion-aasa-exclusions.js",
  "src/url-policy.js",
]) {
  const source = fs.readFileSync(path.resolve(relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const { shouldRedirectToApp, toAppUrl } = context.notionUrlPolicy;
const { pathPatternToRegExp } = context;
const pageId = "0123456789abcdef0123456789abcdef";

test("redirects document paths on current and legacy hosts", () => {
  for (const host of ["app.notion.com", "www.notion.so"]) {
    assert.equal(
      shouldRedirectToApp(`https://${host}/p/${pageId}?pvs=4`),
      true,
      host,
    );
  }
});

test("rejects unsupported hosts and protocols", () => {
  assert.equal(shouldRedirectToApp(`https://notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`https://file.notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`https://www.notion.com/${pageId}`), false);
  assert.equal(shouldRedirectToApp(`http://www.notion.so/${pageId}`), false);
  assert.equal(shouldRedirectToApp("not a url"), false);
});

test("redirects only explicitly allowed additional Notion hosts", () => {
  const url = `https://team.notion.so/p/${pageId}`;
  assert.equal(shouldRedirectToApp(url), false);
  assert.equal(shouldRedirectToApp(url, [], ["team.notion.so"]), true);
  assert.equal(
    shouldRedirectToApp(url, ["/p/*"], ["https://team.notion.so/workspace"]),
    false,
  );
  assert.equal(
    shouldRedirectToApp(`https://notion.so/p/${pageId}`, [], ["notion.so"]),
    true,
  );
});

test("keeps the root and AASA-excluded paths in the browser", () => {
  for (const host of ["app.notion.com", "www.notion.so"]) {
    for (const path of [
      "/",
      "/help",
      "/help/getting-started",
      "/login",
      "/reverify-student-email",
      "/appeals/case-123",
      "/oauth2/authorize",
      "/profile/settings",
      "/desktop/whats-new",
      "/web-clipper/safari/download/release",
    ]) {
      assert.equal(
        shouldRedirectToApp(`https://${host}${path}`),
        false,
        `${host}${path}`,
      );
    }
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
  assert.equal(
    shouldRedirectToApp("https://www.notion.so/private/project/page", [
      "/private/*",
    ]),
    false,
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
  assert.equal(
    toAppUrl(`https://www.notion.so/p/${pageId}?pvs=4#section`),
    `notion://www.notion.so/p/${pageId}?pvs=4#section`,
  );
  assert.equal(
    toAppUrl(`https://team.notion.so/p/${pageId}?pvs=4#section`),
    `notion://team.notion.so/p/${pageId}?pvs=4#section`,
  );
  assert.throws(() => toAppUrl(`https://notion.so.example.com/${pageId}`), {
    name: "TypeError",
  });
});
