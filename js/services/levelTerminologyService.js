const levelTerminologyService = (() => {
  let aliases = {};

  function clean(value) { return String(value || "").trim(); }
  function configure(settings = {}) {
    const source = settings.level_aliases && typeof settings.level_aliases === "object" ? settings.level_aliases : {};
    aliases = Object.fromEntries(Object.entries(source).map(([canonical, alias]) => [clean(canonical), clean(alias)]).filter(([canonical, alias]) => canonical && alias && canonical !== alias));
    return getAliases();
  }
  function clear() { aliases = {}; }
  function getAliases() { return { ...aliases }; }
  function canonicalize(value) {
    const normalized = clean(value);
    return Object.entries(aliases).find(([, alias]) => alias.toLowerCase() === normalized.toLowerCase())?.[0] || normalized;
  }
  function normalizeLevels(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).map(canonicalize).filter(Boolean))];
  }
  function aliasFor(canonical) { return aliases[canonicalize(canonical)] || ""; }
  function format(canonical) {
    const value = canonicalize(canonical);
    const alias = aliasFor(value);
    return alias ? `${value} - ${alias}` : value;
  }
  function checkboxOptions(canonicalLevels = []) {
    return normalizeLevels(canonicalLevels).flatMap(canonical => [
      { value: canonical, canonical, label: canonical, kind: "canonical" },
      ...(aliasFor(canonical) ? [{ value: aliasFor(canonical), canonical, label: aliasFor(canonical), kind: "alias" }] : [])
    ]);
  }
  function synchronizeCheckbox(input, selector = ".crew-level-checkbox") {
    const canonical = input?.dataset?.canonical || canonicalize(input?.value);
    document.querySelectorAll(selector).forEach(box => {
      if ((box.dataset.canonical || canonicalize(box.value)) === canonical) box.checked = input.checked;
    });
  }
  return { configure, clear, getAliases, canonicalize, normalizeLevels, aliasFor, format, checkboxOptions, synchronizeCheckbox };
})();
