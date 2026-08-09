const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const settingsSource = fs.readFileSync(
  path.resolve("src/settings.js"),
  "utf8",
);
const hostSource = fs.readFileSync(
  path.resolve("src/notion-hosts.js"),
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
    disabled: false,
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

async function loadOptionsPage(storage, { setStorage } = {}) {
  const elements = {
    "#setting-keep-tab-open": createElement(),
    "#keep-tab-open-error": createElement(),
    "#settings-form": createElement(),
    "#hosts-form": createElement(),
    "#setting-additional-hosts": createElement(),
    "#additional-hosts-error": createElement(),
    "#additional-hosts-status": createElement(),
    "#setting-excluded-path-patterns": createElement(),
    "#excluded-path-patterns-error": createElement(),
    "#excluded-path-patterns-status": createElement(),
  };
  const context = vm.createContext({
    URL,
    browser: {
      storage: {
        local: {
          async get() {
            return storage;
          },
          async set(value) {
            if (setStorage) {
              await setStorage(value);
            } else {
              Object.assign(storage, value);
            }
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

  vm.runInContext(hostSource, context, { filename: "src/notion-hosts.js" });
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
  let rejectNextWrite = true;
  const { elements } = await loadOptionsPage(storage, {
    async setStorage(value) {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("storage internals should stay hidden");
      }
      Object.assign(storage, value);
    },
  });
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

test("validates and normalizes additional Notion hosts", async () => {
  const storage = {};
  const { elements } = await loadOptionsPage(storage);
  const form = elements["#hosts-form"];
  const textarea = elements["#setting-additional-hosts"];
  const error = elements["#additional-hosts-error"];
  const status = elements["#additional-hosts-status"];

  textarea.value = "https://notion.so.example.com/page";
  await form.dispatch("submit", { preventDefault() {} });
  assert.equal(error.hidden, false);
  assert.equal(
    error.textContent,
    '"https://notion.so.example.com/page" must be a Notion hostname or HTTPS URL.',
  );
  assert.equal(status.hidden, true);

  textarea.value = [
    " notion.so ",
    "https://TEAM.notion.so/project/page?view=compact",
    "team.notion.so",
  ].join("\n");
  await form.dispatch("submit", { preventDefault() {} });

  assert.equal(error.hidden, true);
  assert.equal(status.hidden, false);
  assert.equal(status.textContent, "Hosts saved.");
  assert.equal(textarea.value, "notion.so\nteam.notion.so");
  assert.deepEqual(
    JSON.parse(storage["nad.settings"])["nad.settings.additional-hosts"],
    ["notion.so", "team.notion.so"],
  );
});

test("preserves edits made while additional hosts are being saved", async () => {
  const storage = {};
  let releaseWrite;
  let markWriteStarted;
  const writeStarted = new Promise((resolve) => {
    markWriteStarted = resolve;
  });
  const writeGate = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  const { elements } = await loadOptionsPage(storage, {
    async setStorage(value) {
      markWriteStarted();
      await writeGate;
      Object.assign(storage, value);
    },
  });
  const form = elements["#hosts-form"];
  const textarea = elements["#setting-additional-hosts"];
  const status = elements["#additional-hosts-status"];

  textarea.value = "https://team.notion.so/project";
  const save = form.dispatch("submit", { preventDefault() {} });
  await writeStarted;
  textarea.value = "team.notion.so\nsecond.notion.com";
  releaseWrite();
  await save;

  assert.equal(textarea.value, "team.notion.so\nsecond.notion.com");
  assert.equal(
    status.textContent,
    "Hosts saved. New changes are not saved yet.",
  );
  assert.deepEqual(
    JSON.parse(storage["nad.settings"])["nad.settings.additional-hosts"],
    ["team.notion.so"],
  );
});

test("documents the default hosts in the host input placeholder", () => {
  const html = fs.readFileSync(path.resolve("src/options.html"), "utf8");
  assert.match(
    html,
    /placeholder="app\.notion\.com and www\.notion\.so are allowed by default"/,
  );
});

test("preserves edits made while path patterns are being saved", async () => {
  const storage = {
    "nad.settings": JSON.stringify({
      "nad.settings.keep-tab-open": true,
      "nad.settings.excluded-path-patterns": [],
    }),
  };
  let releaseWrite;
  let markWriteStarted;
  const writeStarted = new Promise((resolve) => {
    markWriteStarted = resolve;
  });
  const writeGate = new Promise((resolve) => {
    releaseWrite = resolve;
  });
  const { elements } = await loadOptionsPage(storage, {
    async setStorage(value) {
      markWriteStarted();
      await writeGate;
      Object.assign(storage, value);
    },
  });
  const form = elements["#settings-form"];
  const textarea = elements["#setting-excluded-path-patterns"];
  const status = elements["#excluded-path-patterns-status"];

  textarea.value = " /private/* ";
  const save = form.dispatch("submit", { preventDefault() {} });
  await writeStarted;
  textarea.value = "/private/*\n/draft/*";
  releaseWrite();
  await save;

  assert.equal(textarea.value, "/private/*\n/draft/*");
  assert.equal(status.hidden, false);
  assert.equal(
    status.textContent,
    "Path patterns saved. New changes are not saved yet.",
  );
  assert.deepEqual(
    JSON.parse(storage["nad.settings"])[
      "nad.settings.excluded-path-patterns"
    ],
    ["/private/*"],
  );
});

test("restores the checkbox and shows an error when saving fails", async () => {
  const storage = {
    "nad.settings": JSON.stringify({
      "nad.settings.keep-tab-open": true,
      "nad.settings.excluded-path-patterns": [],
    }),
  };
  let rejectNextWrite = true;
  const { elements } = await loadOptionsPage(storage, {
    async setStorage(value) {
      if (rejectNextWrite) {
        rejectNextWrite = false;
        throw new Error("storage internals should stay hidden");
      }
      Object.assign(storage, value);
    },
  });
  const checkbox = elements["#setting-keep-tab-open"];
  const error = elements["#keep-tab-open-error"];

  checkbox.checked = false;
  const failedSave = checkbox.dispatch("change", { currentTarget: checkbox });
  assert.equal(checkbox.disabled, true);
  await failedSave;

  assert.equal(checkbox.checked, true);
  assert.equal(checkbox.disabled, false);
  assert.equal(error.hidden, false);
  assert.equal(error.textContent, "Could not save this setting. Please try again.");
  assert.equal(
    JSON.parse(storage["nad.settings"])["nad.settings.keep-tab-open"],
    true,
  );

  checkbox.checked = false;
  await checkbox.dispatch("change", { currentTarget: checkbox });
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.disabled, false);
  assert.equal(error.hidden, true);
  assert.equal(
    JSON.parse(storage["nad.settings"])["nad.settings.keep-tab-open"],
    false,
  );
});
