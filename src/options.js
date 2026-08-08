(
  async () => {
    const settings = await loadSettings();

    const settingKeepTabOpenElem = document.querySelector("#setting-keep-tab-open");
    settingKeepTabOpenElem.checked = settings[settingKeepTabOpenKey] || false;
    settingKeepTabOpenElem.addEventListener("change", (event) =>
      setSetting(settingKeepTabOpenKey, event.currentTarget.checked),
    );

    const settingsForm = document.querySelector("#settings-form");
    const excludedPathPatternsElem = document.querySelector(
      "#setting-excluded-path-patterns",
    );
    const errorElem = document.querySelector("#excluded-path-patterns-error");
    const statusElem = document.querySelector("#excluded-path-patterns-status");
    let patternSaveInFlight = false;

    excludedPathPatternsElem.value = (
      settings[settingExcludedPathPatternsKey] || []
    ).join("\n");

    settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (patternSaveInFlight) {
        return;
      }

      errorElem.hidden = true;
      statusElem.hidden = true;

      const patterns = excludedPathPatternsElem.value
        .split(/\r?\n/)
        .map((pattern) => pattern.trim());
      const invalidPattern = patterns.find(
        (pattern) => pattern && !pattern.startsWith("/"),
      );
      if (invalidPattern) {
        errorElem.textContent = `"${invalidPattern}" must start with /.`;
        errorElem.hidden = false;
        return;
      }

      const normalizedPatterns = normalizeExcludedPathPatterns(patterns);
      patternSaveInFlight = true;
      try {
        await setSetting(settingExcludedPathPatternsKey, normalizedPatterns);
      } catch {
        errorElem.textContent =
          "Could not save path patterns. Please try again.";
        errorElem.hidden = false;
        return;
      } finally {
        patternSaveInFlight = false;
      }

      excludedPathPatternsElem.value = normalizedPatterns.join("\n");
      statusElem.textContent = "Path patterns saved.";
      statusElem.hidden = false;
    });
  }
)();
