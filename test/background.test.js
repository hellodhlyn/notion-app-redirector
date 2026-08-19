const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourceFiles = [
  "src/notion-hosts.js",
  "src/notion-aasa-exclusions.js",
  "src/url-policy.js",
  "src/settings.js",
  "src/background.js",
];
const manifest = JSON.parse(
  fs.readFileSync(path.resolve("manifest.json"), "utf8"),
);

function loadBackground({
  keepTabOpen = false,
  excludedPathPatterns = [],
  additionalHosts = [],
} = {}) {
  const calls = {
    createdTabs: [],
    removedTabs: [],
    storageReads: 0,
  };
  let registration;

  const context = vm.createContext({
    URL,
    setTimeout(callback) {
      callback();
      return 1;
    },
    browser: {
      storage: {
        local: {
          async get() {
            calls.storageReads += 1;
            return {
              "nad.settings": JSON.stringify({
                "nad.settings.keep-tab-open": keepTabOpen,
                "nad.settings.excluded-path-patterns": excludedPathPatterns,
                "nad.settings.additional-hosts": additionalHosts,
              }),
            };
          },
        },
      },
      tabs: {
        async create({ url }) {
          calls.createdTabs.push(url);
          return { id: 99 };
        },
        async remove(tabId) {
          calls.removedTabs.push(tabId);
        },
      },
      webRequest: {
        onBeforeRequest: {
          addListener(listener, filters, extraInfoSpec) {
            registration = { listener, filters, extraInfoSpec };
          },
        },
      },
    },
  });

  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.resolve(relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  }

  return { calls, registration };
}

test("registers supported document hosts and matching permissions", () => {
  const { registration } = loadBackground();
  const supportedUrls = [
    "https://*.notion.com/*",
    "https://*.notion.so/*",
  ];
  assert.deepEqual(Array.from(registration.filters.urls), supportedUrls);
  for (const url of supportedUrls) {
    assert.equal(manifest.permissions.includes(url), true, url);
  }
  assert.deepEqual(Array.from(registration.filters.types), ["main_frame"]);
  assert.deepEqual(Array.from(registration.extraInfoSpec), ["blocking"]);
});

test("keeps a built-in excluded browser path", async () => {
  const { calls, registration } = loadBackground({
    excludedPathPatterns: ["/private/*"],
  });
  const result = await registration.listener({
    url: "https://app.notion.com/help/getting-started",
    tabId: 12,
  });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageReads, 1);
  assert.deepEqual(calls.removedTabs, []);
});

test("keeps popup login bootstrap navigation in the browser", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: false });
  const result = await registration.listener({
    requestId: "popup-login-1",
    url:
      "https://app.notion.com/verifyNoPopupBlockerHtmlAndRedirect" +
      "?redirectUri=https%3A%2F%2Fapp.notion.com%2Fgooglepopupredirect%3FcallbackType%3Dpopup%26redirectToAuth%3Dtrue",
    tabId: 12,
  });

  assert.equal(Object.keys(result).length, 0);
  assert.deepEqual(calls.createdTabs, []);
  assert.deepEqual(calls.removedTabs, []);
});

test("does not redirect a configured exact path", async () => {
  const { calls, registration } = loadBackground({
    excludedPathPatterns: ["/specific-page"],
  });
  const result = await registration.listener({
    url: "https://app.notion.com/specific-page?view=compact#details",
    tabId: 12,
  });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageReads, 1);
  assert.deepEqual(calls.createdTabs, []);
  assert.deepEqual(calls.removedTabs, []);
});

test("does not redirect a configured wildcard path", async () => {
  const { calls, registration } = loadBackground({
    excludedPathPatterns: ["/private/*"],
  });
  const result = await registration.listener({
    url: "https://app.notion.com/private/project/page",
    tabId: 12,
  });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageReads, 1);
  assert.deepEqual(calls.createdTabs, []);
  assert.deepEqual(calls.removedTabs, []);
});

test("opens the app only once for a redirect chain while preserving the browser tab", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: true });
  const requestId = "redirect-chain-1";
  const initialUrl =
    "https://app.notion.com/p/0123456789abcdef0123456789abcdef?temporary=1";
  const initialResult = await registration.listener({
    requestId,
    url: initialUrl,
    tabId: 12,
  });
  assert.equal(Object.keys(initialResult).length, 0);

  const finalUrl =
    "https://app.notion.com/p/0123456789abcdef0123456789abcdef";
  const finalResult = await registration.listener({
    requestId,
    url: finalUrl,
    tabId: 12,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(Object.keys(finalResult).length, 0);
  assert.equal(calls.storageReads, 1);
  assert.deepEqual(calls.createdTabs, [
    initialUrl.replace(/^https:/, "notion:"),
  ]);
  assert.deepEqual(calls.removedTabs, [99]);
});

test("opens the app for separate navigation requests", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: true });
  const pageId = "0123456789abcdef0123456789abcdef";

  for (const requestId of ["navigation-1", "navigation-2"]) {
    const result = await registration.listener({
      requestId,
      url: `https://app.notion.com/p/${pageId}`,
      tabId: 12,
    });
    assert.equal(Object.keys(result).length, 0);
  }
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.storageReads, 2);
  assert.deepEqual(calls.createdTabs, [
    `notion://app.notion.com/p/${pageId}`,
    `notion://app.notion.com/p/${pageId}`,
  ]);
  assert.deepEqual(calls.removedTabs, [99, 99]);
});

test("redirects a document and auto-closes the original tab", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: false });
  const pageId = "0123456789abcdef0123456789abcdef";
  const result = await registration.listener({
    url: `https://app.notion.com/p/${pageId}?pvs=4`,
    tabId: 12,
  });
  assert.equal(
    result.redirectUrl,
    `notion://app.notion.com/p/${pageId}?pvs=4`,
  );
  assert.deepEqual(calls.removedTabs, [12]);
});

test("redirects a legacy notion.so document without changing its host", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: false });
  const pageId = "0123456789abcdef0123456789abcdef";
  const result = await registration.listener({
    url: `https://www.notion.so/p/${pageId}?pvs=4#section`,
    tabId: 12,
  });
  assert.equal(
    result.redirectUrl,
    `notion://www.notion.so/p/${pageId}?pvs=4#section`,
  );
  assert.deepEqual(calls.removedTabs, [12]);
});

test("redirects only configured additional hosts and preserves their host", async () => {
  const pageId = "0123456789abcdef0123456789abcdef";
  const unconfigured = loadBackground({ keepTabOpen: false });
  const unconfiguredResult = await unconfigured.registration.listener({
    url: `https://team.notion.so/p/${pageId}`,
    tabId: 12,
  });
  assert.equal(Object.keys(unconfiguredResult).length, 0);
  assert.deepEqual(unconfigured.calls.removedTabs, []);

  const configured = loadBackground({
    keepTabOpen: false,
    additionalHosts: ["team.notion.so"],
  });
  const configuredResult = await configured.registration.listener({
    url: `https://team.notion.so/p/${pageId}?view=compact#section`,
    tabId: 12,
  });
  assert.equal(
    configuredResult.redirectUrl,
    `notion://team.notion.so/p/${pageId}?view=compact#section`,
  );
  assert.deepEqual(configured.calls.removedTabs, [12]);
});

test("opens and auto-closes an app tab while preserving the browser tab", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: true });
  const pageId = "0123456789abcdef0123456789abcdef";
  const result = await registration.listener({
    requestId: "navigation-1",
    url: `https://app.notion.com/p/${pageId}`,
    tabId: 12,
  });
  assert.equal(Object.keys(result).length, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.createdTabs, [
    `notion://app.notion.com/p/${pageId}`,
  ]);
  assert.deepEqual(calls.removedTabs, [99]);
});
