(
  async () => {
    const settings = await loadSettings();

    const settingKeepTabOpenElem = document.querySelector('#setting-keep-tab-open');
    settingKeepTabOpenElem.checked = settings[settingKeepTabOpenKey] || false;
    settingKeepTabOpenElem.onchange = (event) => {
      setSetting(settingKeepTabOpenKey, event.currentTarget.checked);
    };
  }
)();
