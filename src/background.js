const openedAppRequestIds = new Set();
const maxRememberedAppRequestIds = 256;

function hasOpenedAppForRequest(requestId) {
  return typeof requestId === "string" && openedAppRequestIds.has(requestId);
}

function rememberAppOpenForRequest(requestId) {
  if (typeof requestId !== "string") {
    return;
  }

  openedAppRequestIds.add(requestId);
  if (openedAppRequestIds.size > maxRememberedAppRequestIds) {
    openedAppRequestIds.delete(openedAppRequestIds.values().next().value);
  }
}

function forgetAppOpenForRequest(requestId) {
  if (typeof requestId === "string") {
    openedAppRequestIds.delete(requestId);
  }
}

async function redirect(details) {
  if (hasOpenedAppForRequest(details.requestId)) {
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
    rememberAppOpenForRequest(details.requestId);
    browser.tabs.create({ url: notionScheme }).then(
      (tab) => {
        setTimeout(() => browser.tabs.remove(tab.id), 5000);
      },
      () => forgetAppOpenForRequest(details.requestId),
    );
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
browser.webRequest.onBeforeRequest.addListener(redirect, filters, ["blocking"]);
