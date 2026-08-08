(
  async () => {
    const settings = await loadSettings();

    const settingKeepTabOpenElem = document.querySelector("#setting-keep-tab-open");
    const keepTabOpenErrorElem = document.querySelector("#keep-tab-open-error");
    let savedKeepTabOpen = settings[settingKeepTabOpenKey] || false;
    settingKeepTabOpenElem.checked = savedKeepTabOpen;
    settingKeepTabOpenElem.addEventListener("change", async (event) => {
      const checkbox = event.currentTarget;
      const nextKeepTabOpen = checkbox.checked;
      keepTabOpenErrorElem.hidden = true;
      checkbox.disabled = true;

      try {
        await setSetting(settingKeepTabOpenKey, nextKeepTabOpen);
        savedKeepTabOpen = nextKeepTabOpen;
      } catch {
        checkbox.checked = savedKeepTabOpen;
        keepTabOpenErrorElem.textContent =
          "Could not save this setting. Please try again.";
        keepTabOpenErrorElem.hidden = false;
      } finally {
        checkbox.disabled = false;
      }
    });

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

      const submittedValue = excludedPathPatternsElem.value;
      const patterns = submittedValue
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

      const inputChangedWhileSaving =
        excludedPathPatternsElem.value !== submittedValue;
      if (!inputChangedWhileSaving) {
        excludedPathPatternsElem.value = normalizedPatterns.join("\n");
      }
      statusElem.textContent = inputChangedWhileSaving
        ? "Path patterns saved. New changes are not saved yet."
        : "Path patterns saved.";
      statusElem.hidden = false;
    });
  }
)();
