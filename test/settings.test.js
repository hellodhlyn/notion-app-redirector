const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const hostSource = fs.readFileSync(
  path.resolve("src/notion-hosts.js"),
  "utf8",
);
const source = fs.readFileSync(path.resolve("src/settings.js"), "utf8");

function loadSettingsContext(storage, { set } = {}) {
  const context = vm.createContext({
    URL,
    browser: {
      storage: {
        local: {
          async get() {
            return storage;
          },
          async set(value) {
            if (set) {
              return set(value);
            }
            Object.assign(storage, value);
          },
        },
      },
    },
  });
  vm.runInContext(hostSource, context, { filename: "src/notion-hosts.js" });
  vm.runInContext(source, context, { filename: "src/settings.js" });
  vm.runInContext(
    `globalThis.settingsTestApi = {
      loadSettings,
      setSetting,
      settingKeepTabOpenKey,
      settingExcludedPathPatternsKey,
      settingAdditionalHostsKey,
    };`,
    context,
  );
  return context.settingsTestApi;
}

test("persists normalized excluded path patterns without changing tab setting", async () => {
  const storage = {};
  const firstSession = loadSettingsContext(storage);

  await firstSession.setSetting(firstSession.settingKeepTabOpenKey, false);
  await firstSession.setSetting(firstSession.settingExcludedPathPatternsKey, [
    " /private/* ",
    "/private/*",
    "",
    "team/acme/*",
    "/specific-page",
  ]);
  await firstSession.setSetting(firstSession.settingAdditionalHostsKey, [
    " notion.so ",
    "https://TEAM.notion.so/project/page?view=compact",
    "team.notion.so",
    "https://notion.so.example.com/page",
    "http://legacy.notion.so/page",
  ]);

  const restartedSession = loadSettingsContext(storage);
  assert.deepEqual(JSON.parse(JSON.stringify(await restartedSession.loadSettings())), {
    [restartedSession.settingKeepTabOpenKey]: false,
    [restartedSession.settingExcludedPathPatternsKey]: [
      "/private/*",
      "/specific-page",
    ],
    [restartedSession.settingAdditionalHostsKey]: [
      "notion.so",
      "team.notion.so",
    ],
  });
});

test("loads defaults when no settings have been saved", async () => {
  const settings = loadSettingsContext({});
  assert.deepEqual(JSON.parse(JSON.stringify(await settings.loadSettings())), {
    [settings.settingKeepTabOpenKey]: true,
    [settings.settingExcludedPathPatternsKey]: [],
    [settings.settingAdditionalHostsKey]: [],
  });
});

test("serializes overlapping setting writes without losing either update", async () => {
  const storage = {};
  let releaseFirstWrite;
  const firstWriteStarted = new Promise((resolve) => {
    releaseFirstWrite = resolve;
  });
  let continueFirstWrite;
  const firstWriteGate = new Promise((resolve) => {
    continueFirstWrite = resolve;
  });
  let writeCount = 0;
  const settings = loadSettingsContext(storage, {
    set(value) {
      writeCount += 1;
      if (writeCount === 1) {
        releaseFirstWrite();
        return firstWriteGate.then(() => Object.assign(storage, value));
      }
      Object.assign(storage, value);
    },
  });

  const keepTabWrite = settings.setSetting(
    settings.settingKeepTabOpenKey,
    false,
  );
  await firstWriteStarted;
  const excludedPatternsWrite = settings.setSetting(
    settings.settingExcludedPathPatternsKey,
    ["/private/*"],
  );
  continueFirstWrite();

  await Promise.all([keepTabWrite, excludedPatternsWrite]);
  const persisted = JSON.parse(storage["nad.settings"]);
  assert.equal(persisted[settings.settingKeepTabOpenKey], false);
  assert.deepEqual(
    persisted[settings.settingExcludedPathPatternsKey],
    ["/private/*"],
  );
  assert.deepEqual(persisted[settings.settingAdditionalHostsKey], []);
});

test("recovers the settings write queue after a rejected write", async () => {
  const storage = {};
  let rejectFirstWrite;
  const firstWriteStarted = new Promise((resolve) => {
    rejectFirstWrite = resolve;
  });
  let failFirstWrite;
  const firstWriteGate = new Promise((resolve, reject) => {
    failFirstWrite = reject;
  });
  let writeCount = 0;
  const settings = loadSettingsContext(storage, {
    set(value) {
      writeCount += 1;
      if (writeCount === 1) {
        rejectFirstWrite();
        return firstWriteGate.then(() => Object.assign(storage, value));
      }
      Object.assign(storage, value);
    },
  });

  const failedWrite = settings.setSetting(
    settings.settingKeepTabOpenKey,
    false,
  );
  await firstWriteStarted;
  const laterWrite = settings.setSetting(
    settings.settingExcludedPathPatternsKey,
    ["/private/*"],
  );
  failFirstWrite(new Error("write failed"));

  await assert.rejects(failedWrite, /write failed/);
  await laterWrite;
  const persisted = JSON.parse(storage["nad.settings"]);
  assert.equal(persisted[settings.settingKeepTabOpenKey], true);
  assert.deepEqual(
    persisted[settings.settingExcludedPathPatternsKey],
    ["/private/*"],
  );
  assert.deepEqual(persisted[settings.settingAdditionalHostsKey], []);
});
