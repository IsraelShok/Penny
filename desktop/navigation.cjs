// Where the desktop window may navigate, and which links may be handed to the OS.
// Pure, so it is tested without Electron (tests/desktop-navigation.test.ts).

const parse = (target) => {
  try {
    return new URL(target);
  } catch {
    return null;
  }
};

/** Compares origins, not prefixes: http://127.0.0.1:port@evil.example starts with the app URL. */
function isAppUrl(target, appOrigin) {
  const u = parse(target);
  return !!u && u.origin === appOrigin;
}

/** Only web and mail links go to the OS: file:, ms-msdt: and the like can launch programs. */
function isSafeExternal(target) {
  const u = parse(target);
  return !!u && ["https:", "http:", "mailto:"].includes(u.protocol);
}

module.exports = { isAppUrl, isSafeExternal };
