const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

async function redirect(details) {
  if (redirectStatusCodes.has(details.statusCode)) {
    return {};
  }

  const settings = await loadSettings();
  if (
    !notionUrlPolicy.shouldRedirectToApp(
      details.url,
      settings[settingExcludedPathPatternsKey],
      settings[settingAdditionalHostsKey],
    )
  ) {
    return {};
  }

  const keepTabOpen = settings[settingKeepTabOpenKey] || false;

  const notionScheme = notionUrlPolicy.toAppUrl(details.url);
  if (keepTabOpen) {
    browser.tabs.create({ url: notionScheme }).then((tab) => {
      setTimeout(() => browser.tabs.remove(tab.id), 5000);
    });
    return {};
  } else {
    try {
      return { redirectUrl: notionScheme };
    } finally {
      if (details.tabId !== -1) {
        setTimeout(() => browser.tabs.remove(details.tabId), 5000);
      }
    }
  }
}

const filters = {
  urls: ["https://*.notion.com/*", "https://*.notion.so/*"],
  types: ["main_frame"],
};
browser.webRequest.onHeadersReceived.addListener(redirect, filters, ["blocking"]);
