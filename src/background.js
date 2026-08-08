// Temporarily keep redirect tabs open while investigating duplicate app links.
const autoCloseRedirectTabs = false;
const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

async function redirect(details) {
  if (redirectStatusCodes.has(details.statusCode)) {
    return {};
  }

  if (!notionUrlPolicy.shouldRedirectToApp(details.url)) {
    return {};
  }

  // Redirect with scheme.
  const settings = await loadSettings();
  const keepTabOpen = settings[settingKeepTabOpenKey] || false;

  const notionScheme = notionUrlPolicy.toAppUrl(details.url);
  if (keepTabOpen) {
    browser.tabs.create({ url: notionScheme }).then((tab) => {
      if (autoCloseRedirectTabs) {
        setTimeout(() => browser.tabs.remove(tab.id), 5000);
      }
    });
    return {};
  } else {
    try {
      return { redirectUrl: notionScheme };
    } finally {
      if (autoCloseRedirectTabs && details.tabId !== -1) {
        setTimeout(() => browser.tabs.remove(details.tabId), 5000);
      }
    }
  }
}

const filters = {
  urls: ["https://app.notion.com/*"],
  types: ["main_frame"],
};
browser.webRequest.onHeadersReceived.addListener(redirect, filters, ["blocking"]);
