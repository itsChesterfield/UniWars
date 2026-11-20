// Ersatz für Google Fonts beim lokalen Build (Sandbox ohne Zugriff auf fonts.googleapis.com)
const F = "/home/claude/ext/fonts/node_modules/@fontsource-variable";
const css = (fam, datei, gewicht) => `@font-face {
  font-family: '${fam}';
  font-style: normal;
  font-weight: ${gewicht};
  font-display: swap;
  src: url(${datei}) format('woff2');
}
`;
const bric = css("Bricolage Grotesque", `${F}/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2`, "200 800")
  + css("Bricolage Grotesque", `${F}/bricolage-grotesque/files/bricolage-grotesque-latin-ext-opsz-normal.woff2`, "200 800");
const mono = css("JetBrains Mono", `${F}/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2`, "100 800")
  + css("JetBrains Mono", `${F}/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2`, "100 800");
module.exports = new Proxy({}, { get: (_, url) => (String(url).includes("Bricolage") ? bric : String(url).includes("JetBrains") ? mono : undefined) });
