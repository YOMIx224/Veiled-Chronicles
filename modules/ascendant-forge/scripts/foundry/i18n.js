/**
 * Localization helpers. Content text is stored bilingually ({en, th}) in the data
 * files; UI strings live in lang/*.json.
 */

/** Pick the current language from a {en, th} object (falls back to English). */
export function loc(text) {
  if ( text == null ) return "";
  if ( typeof text === "string" ) return text;
  const lang = game.i18n.lang;
  return text[lang] ?? text.en ?? Object.values(text)[0] ?? "";
}

export function notify(level, key, data = {}) {
  const fn = { info: "info", warn: "warn", error: "error" }[level] ?? "info";
  ui.notifications[fn](game.i18n.format(key, data));
  return null;
}

/** Human-readable list of failed condition keys. */
export function describeFailures(failed = []) {
  return failed.map(f => {
    const key = `AF.Cond.${f.key}`;
    const label = game.i18n.has(key) ? game.i18n.localize(key) : f.key;
    const value = typeof f.value === "object" ? JSON.stringify(f.value) : String(f.value);
    return `${label}: ${value}`;
  }).join("; ");
}

/** Localize a validation error ({code, data, message}). */
export function errorText(error) {
  const key = `AF.Error.${error.code}`;
  if ( !game.i18n.has(key) ) return error.message;
  const data = { ...error.data };
  for ( const [k, v] of Object.entries(data) ) if ( Array.isArray(v) ) data[k] = k === "failed" ? describeFailures(v) : v.join(", ");
  return game.i18n.format(key, data);
}
