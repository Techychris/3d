import fs from "fs";
const d = new URL(".", import.meta.url).pathname;
fs.writeFileSync(d + "style.js", "// generated from style.css by build-style.mjs\nexport default " + JSON.stringify(fs.readFileSync(d + "style.css", "utf8")) + ";\n");
