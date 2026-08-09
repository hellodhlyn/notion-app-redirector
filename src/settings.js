const settingsKey = 'nad.settings';
const settingKeepTabOpenKey = 'nad.settings.keep-tab-open';
const settingExcludedPathPatternsKey = 'nad.settings.excluded-path-patterns';
const settingAdditionalHostsKey = 'nad.settings.additional-hosts';

const defaultSettings = {
  [settingKeepTabOpenKey]: true,
  [settingExcludedPathPatternsKey]: [],
  [settingAdditionalHostsKey]: [],
};
let settingsWriteQueue = Promise.resolve();

function normalizeExcludedPathPatterns(patterns) {
  if (!Array.isArray(patterns)) {
    return [];
  }

  const normalizedPatterns = [];
  const seenPatterns = new Set();
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      continue;
    }

    const normalizedPattern = pattern.trim();
    if (
      !normalizedPattern ||
      !normalizedPattern.startsWith('/') ||
      seenPatterns.has(normalizedPattern)
    ) {
      continue;
    }

    seenPatterns.add(normalizedPattern);
    normalizedPatterns.push(normalizedPattern);
  }

  return normalizedPatterns;
}

function createDefaultSettings() {
  return {
    ...defaultSettings,
    [settingExcludedPathPatternsKey]: [],
    [settingAdditionalHostsKey]: [],
  };
}

async function loadSettings() {
  const value = await browser.storage.local.get(settingsKey);
  if (!value || !value[settingsKey]) {
    return createDefaultSettings();
  }

  const storedSettings = JSON.parse(value[settingsKey]);
  return {
    ...defaultSettings,
    ...storedSettings,
    [settingExcludedPathPatternsKey]: normalizeExcludedPathPatterns(
      storedSettings[settingExcludedPathPatternsKey],
    ),
    [settingAdditionalHostsKey]: notionHostPolicy.normalizeAdditionalHosts(
      storedSettings[settingAdditionalHostsKey],
    ),
  };
}

async function setSetting(key, value) {
  const write = settingsWriteQueue.then(async () => {
    const settings = await loadSettings();
    settings[key] =
      key === settingExcludedPathPatternsKey
        ? normalizeExcludedPathPatterns(value)
        : key === settingAdditionalHostsKey
          ? notionHostPolicy.normalizeAdditionalHosts(value)
          : value;
    await browser.storage.local.set({ [settingsKey]: JSON.stringify(settings) });
  });
  settingsWriteQueue = write.catch(() => {});
  return write;
}
