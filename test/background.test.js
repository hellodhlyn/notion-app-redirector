const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const sourceFiles = [
  "src/notion-aasa-exclusions.js",
  "src/url-policy.js",
  "src/settings.js",
  "src/background.js",
];

function loadBackground({ keepTabOpen = false } = {}) {
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
        onHeadersReceived: {
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

test("registers only the canonical app host and main-frame requests", () => {
  const { registration } = loadBackground();
  assert.deepEqual(Array.from(registration.filters.urls), [
    "https://app.notion.com/*",
  ]);
  assert.deepEqual(Array.from(registration.filters.types), ["main_frame"]);
  assert.deepEqual(Array.from(registration.extraInfoSpec), ["blocking"]);
});

test("does not load settings for an excluded browser path", async () => {
  const { calls, registration } = loadBackground();
  const result = await registration.listener({
    url: "https://app.notion.com/help/getting-started",
    tabId: 12,
    statusCode: 200,
  });
  assert.equal(Object.keys(result).length, 0);
  assert.equal(calls.storageReads, 0);
  assert.deepEqual(calls.removedTabs, []);
});

test("waits for server redirects to finish before opening the app", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: true });
  const redirectResult = await registration.listener({
    url: "https://app.notion.com/p/0123456789abcdef0123456789abcdef?temporary=1",
    tabId: 12,
    statusCode: 307,
  });
  assert.equal(Object.keys(redirectResult).length, 0);

  const finalUrl =
    "https://app.notion.com/p/0123456789abcdef0123456789abcdef";
  const finalResult = await registration.listener({
    url: finalUrl,
    tabId: 12,
    statusCode: 200,
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(Object.keys(finalResult).length, 0);
  assert.equal(calls.storageReads, 1);
  assert.deepEqual(calls.createdTabs, [
    "notion://app.notion.com/p/0123456789abcdef0123456789abcdef",
  ]);
  assert.deepEqual(calls.removedTabs, []);
});

test("redirects a document without auto-closing the original tab while debugging", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: false });
  const pageId = "0123456789abcdef0123456789abcdef";
  const result = await registration.listener({
    url: `https://app.notion.com/p/${pageId}?pvs=4`,
    tabId: 12,
    statusCode: 200,
  });
  assert.equal(
    result.redirectUrl,
    `notion://app.notion.com/p/${pageId}?pvs=4`,
  );
  assert.deepEqual(calls.removedTabs, []);
});

test("opens an app tab without auto-closing it while preserving the browser tab", async () => {
  const { calls, registration } = loadBackground({ keepTabOpen: true });
  const pageId = "0123456789abcdef0123456789abcdef";
  const result = await registration.listener({
    url: `https://app.notion.com/p/${pageId}`,
    tabId: 12,
    statusCode: 200,
  });
  assert.equal(Object.keys(result).length, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.createdTabs, [
    `notion://app.notion.com/p/${pageId}`,
  ]);
  assert.deepEqual(calls.removedTabs, []);
});
