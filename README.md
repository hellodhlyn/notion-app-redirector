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
| **Additional hosts to open in the Notion app** | Allows exact `notion.com` or `notion.so` hostnames in addition to `app.notion.com` and `www.notion.so`. Full HTTPS URLs are normalized to their hostname. | Empty |
| **Additional paths to keep in the browser** | Prevents matching paths on every allowed host from opening in the desktop app. | Empty |

For additional hosts, enter one exact hostname or HTTPS URL per line. Wildcards
and domains outside `notion.com` and `notion.so` are rejected.

```text
notion.so
team.notion.so
https://workspace.notion.com/project/page
```

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
