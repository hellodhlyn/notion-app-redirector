# Open in Notion App

> Open [notion](https://www.notion.so) documents with your desktop application directly.

## Install

* [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/open-in-notion-app)

## Tested Browsers

  - Firefox

## Options

In Firefox, open `about:addons`, select **Open in Notion App**, and open the
**Preferences** or **Options** tab to manage the extension settings.

| Setting | Description | Default |
| --- | --- | --- |
| **Keep browser tabs open after redirection** | Keeps the original browser tab open after the document is sent to the Notion desktop app. | Enabled |
| **Additional paths to keep in the browser** | Prevents matching `app.notion.com` paths from opening in the desktop app. | Empty |

For additional paths, enter one pathname glob per line. Enter only the pathname, not a full URL.

```text
/private/*
/team/acme/*
/specific-page
```

## Development

```sh
# Test
node --test

# Check the bundled Notion URL exclusions against the current AASA files
node scripts/update-notion-aasa-exclusions.mjs --check

# Build
web-ext build
```

## License

This project is licensed under the [Mozilla Public License 2.0](LICENSE).
