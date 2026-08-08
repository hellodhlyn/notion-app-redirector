const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const settingsSource = fs.readFileSync(
  path.resolve("src/settings.js"),
  "utf8",
);
const optionsSource = fs.readFileSync(
  path.resolve("src/options.js"),
  "utf8",
);

function createElement() {
  const listeners = new Map();
  return {
    checked: false,
    hidden: false,
    textContent: "",
    value: "",
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      return listeners.get(type)(event);
    },
  };
}

async function loadOptionsPage(storage) {
  const elements = {
    "#setting-keep-tab-open": createElement(),
    "#settings-form": createElement(),
    "#setting-excluded-path-patterns": createElement(),
    "#excluded-path-patterns-error": createElement(),
    "#excluded-path-patterns-status": createElement(),
  };
  let rejectNextWrite = true;
  const context = vm.createContext({
    browser: {
      storage: {
        local: {
          async get() {
            return storage;
          },
          async set(value) {
            if (rejectNextWrite) {
              rejectNextWrite = false;
              throw new Error("storage internals should stay hidden");
            }
            Object.assign(storage, value);
          },
        },
      },
    },
    document: {
      querySelector(selector) {
        return elements[selector];
      },
    },
    setImmediate,
  });

  vm.runInContext(settingsSource, context, { filename: "src/settings.js" });
  vm.runInContext(optionsSource, context, { filename: "src/options.js" });
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, storage };
}

test("shows save failures and preserves input before a later normalized save succeeds", async () => {
  const storage = {
    "nad.settings": JSON.stringify({
      "nad.settings.keep-tab-open": true,
      "nad.settings.excluded-path-patterns": [],
    }),
  };
  const { elements } = await loadOptionsPage(storage);
  const form = elements["#settings-form"];
  const textarea = elements["#setting-excluded-path-patterns"];
  const error = elements["#excluded-path-patterns-error"];
  const status = elements["#excluded-path-patterns-status"];
  const unsavedInput = " /private/* \n/private/* \n";

  textarea.value = unsavedInput;
  await form.dispatch("submit", { preventDefault() {} });
  assert.equal(error.hidden, false);
  assert.equal(
    error.textContent,
    "Could not save path patterns. Please try again.",
  );
  assert.equal(status.hidden, true);
  assert.equal(textarea.value, unsavedInput);

  await form.dispatch("submit", { preventDefault() {} });
  assert.equal(error.hidden, true);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, "Path patterns saved.");
  assert.equal(textarea.value, "/private/*");
  assert.deepEqual(
    JSON.parse(storage["nad.settings"])[
      "nad.settings.excluded-path-patterns"
    ],
    ["/private/*"],
  );
});
