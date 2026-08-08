# notion-app-redirector

> Open [notion](https://www.notion.so) documents with your desktop application directly.

## Install

* [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/open-in-notion-app)

## Tested Browsers

  - Firefox

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
