// Paths listed below shouldn't be redirect to application.
// Taken from https://www.notion.so/apple-app-site-association
const exceptingPaths = [
  "/@",
  "/about",
  "/affiliates",
  "/ai",
  "/android",
  "/api-beta",
  "/appleauthcallback",
  "/applepopupcallback",
  "/applepopupredirect",
  "/asanaauthcallback",
  "/asanapopupredirect",
  "/blog",
  "/careers",
  "/community",
  "/compare-against",
  "/components",
  "/confluence",
  "/consultants",
  "/contact-sales",
  "/customers",
  "/da-dk",
  "/de-de",
  "/desktop",
  "/docs",
  "/educators",
  "/email-confirm",
  "/en-us",
  "/enterprise",
  "/es-es",
  "/es-la",
  "/events",
  "/evernote",
  "/evernoteoauthcallback",
  "/evernotepopupredirect",
  "/externalauthcallback",
  "/externalintegrationauthcallback",
  "/externalintegrationpopupredirect",
  "/fi-fi",
  "/fr-fr",
  "/front-api",
  "/front-static",
  "/googledrivepickerpopup",
  "/googledrivepopupredirect",
  "/googlepopupcallback",
  "/googlepopupredirect",
  "/guide",
  "/guides",
  "/help",
  "/help",
  "/install-integration",
  "/integrations",
  "/invoice",
  "/ja-jp",
  "/jobs",
  "/join-us",
  "/ko-kr",
  "/ko",
  "/login",
  "/loginpasswordreset",
  "/loginwithemail",
  "/logout",
  "/mobile",
  "/my-integrations",
  "/native/oauth2callback",
  "/nb-no",
  "/nl-nl",
  "/nonprofits",
  "/notes",
  "/oauth2callback",
  "/onboarding",
  "/pages",
  "/passwordchangeredirect",
  "/passwordresetcallback",
  "/personal",
  "/pricing",
  "/product",
  "/product/ai",
  "/product/docs",
  "/product/projects",
  "/product/wikis",
  "/projects",
  "/pseudo",
  "/pt-br",
  "/releases",
  "/remote",
  "/resources",
  "/samlauthcallback",
  "/sandbox",
  "/security",
  "/signup",
  "/sitemap.xml",
  "/slackoauthcallback",
  "/slackpopupredirect",
  "/sso/saml",
  "/startups",
  "/storybook",
  "/students",
  "/sv-se",
  "/teams",
  "/template-preview",
  "/templates",
  "/tools-and-craft",
  "/trelloauthcallback",
  "/trellopopupredirect",
  "/unsubscribe",
  "/upgraded-account",
  "/use-case",
  "/web-clipper",
  "/webinars",
  "/why",
  "/wiki",
  "/wikis",
  "/work",
  "/zh-cn",
  "/zh-tw",
];

async function redirect(details) {
  // Ignore urls which are not for document pages, such as js/css file and more.
  if (details.documentUrl) {
    return {};
  }

  const element = document.createElement("a");
  element.href = details.url;

  // Ignore some reserved keywords for notion homepage.
  if (
    !element.pathname ||
    element.pathname === "/" ||
    exceptingPaths.find((path) => element.pathname.startsWith(path))
  ) {
    return {};
  }

  // Redirect with scheme.
  const settings = await loadSettings();
  const keepTabOpen = settings[settingKeepTabOpenKey] || false;

  const notionScheme = details.url.replace("https", "notion");
  if (keepTabOpen) {
    browser.tabs.create({ url: notionScheme }).then((tab) =>
      setTimeout(() => {
        browser.tabs.remove(tab.id);
      }, 5000)
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

const filters = { urls: ["https://*.notion.so/*"] };
browser.webRequest.onBeforeRequest.addListener(redirect, filters, ["blocking"]);
