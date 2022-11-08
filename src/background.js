// Paths listed below shouldn't be redirect to application.
const exceptingPaths = [
  '/desktop', '/login', '/mobile', '/product', '/pricing', '/native', '/invoice', '/web-clipper', '/help'
];

async function redirect(details) {
  // Ignore urls which are not for document pages, such as js/css file and more.
  if (details.documentUrl) {
    return {};
  }

  const element = document.createElement('a');
  element.href = details.url;

  // Ignore some reserved keywords for notion homepage.
  if (!element.pathname
      || element.pathname === '/'
      || exceptingPaths.find(path => element.pathname.startsWith(path))
  ) {
    return {};
  }

  // Redirect with scheme.
  const settings = await loadSettings();
  const keepTabOpen = settings[settingKeepTabOpenKey] || false;

  const notionScheme = details.url.replace('https', 'notion');
  if (keepTabOpen) {
    browser.tabs.create({ url: notionScheme }).then((tab) => setTimeout(() => { browser.tabs.remove(tab.id) }, 5000));
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

const filters = { urls: ['https://*.notion.so/*'] };
browser.webRequest.onBeforeRequest.addListener(redirect, filters, ['blocking']);
