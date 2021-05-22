const settingsKey = 'nad.settings';
const settingKeepTabOpenKey = 'nad.settings.keep-tab-open';

async function loadSettings() {
  const value = await browser.storage.local.get(settingsKey);
  if (!value || !value[settingsKey]) {
    return {};
  }
  return JSON.parse(value[settingsKey]);
}

async function setSetting(key, value) {
  const settings = await loadSettings();
  settings[key] = value;
  await browser.storage.local.set({[settingsKey]: JSON.stringify(settings)});
}
