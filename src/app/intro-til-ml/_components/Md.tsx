import s from "../intro.module.css";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// * og ** åpner bare etter start/mellomrom/tegn (ikke bokstav/tall) og lukker bare før en ikke-alfanumerisk tegn,
// så regnestykker som w1*x1 + w2*x2 blir stående urørt.
function inline(raw: string) {
  const codes: string[] = [];
  const t = esc(raw).replace(/`([^`]+)`/g, (_, c) => `\u0001${codes.push(`<code>${c}</code>`) - 1}\u0001`);
  return t
    .replace(/(^|[^\p{L}\p{N})\]}])\*\*(\S(?:.*?\S)?)\*\*(?![\p{L}\p{N}])/gu, "$1<strong>$2</strong>")
    .replace(/(^|[^\p{L}\p{N}*)\]}])\*(\S(?:.*?\S)?)\*(?![\p{L}\p{N}*])/gu, "$1<em>$2</em>")
    .replace(/\u0001(\d+)\u0001/g, (_, i) => codes[+i]);
}

const BLOCK = /^\s*(```|\||- |\d+\. |#{1,6}\s|---+\s*$)/;

function render(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  const take = (ok: (l: string) => boolean) => {
    const got: string[] = [];
    while (i < lines.length && ok(lines[i])) got.push(lines[i++]);
    return got;
  };
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*```/.test(l)) {
      i++;
      const code = take((x) => !/^\s*```/.test(x));
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
    } else if (/^\s*\|/.test(l)) {
      const rows = take((x) => /^\s*\|/.test(x))
        .filter((r) => !/^[\s|:-]+$/.test(r))
        .map((r) => r.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, "|"))));
      const tr = (r: string[], tag: string) => `<tr>${r.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
      out.push(
        `<div style="overflow-x:auto"><table><thead>${tr(rows[0] ?? [], "th")}</thead><tbody>${rows.slice(1).map((r) => tr(r, "td")).join("")}</tbody></table></div>`,
      );
    } else if (/^\s*- /.test(l)) {
      out.push(`<ul>${take((x) => /^\s*- /.test(x)).map((x) => `<li>${inline(x.replace(/^\s*- /, ""))}</li>`).join("")}</ul>`);
    } else if (/^\s*\d+\. /.test(l)) {
      out.push(`<ol>${take((x) => /^\s*\d+\. /.test(x)).map((x) => `<li>${inline(x.replace(/^\s*\d+\. /, ""))}</li>`).join("")}</ol>`);
    } else if (/^\s*#{1,6}\s/.test(l)) {
      out.push(`<p><strong>${inline(l.replace(/^\s*#+\s*/, ""))}</strong></p>`);
      i++;
    } else if (/^\s*---+\s*$/.test(l)) {
      out.push("<hr>");
      i++;
    } else if (!l.trim()) {
      i++;
    } else {
      out.push(`<p>${take((x) => !!x.trim() && !BLOCK.test(x)).map(inline).join("<br>")}</p>`);
    }
  }
  return out.join("");
}

export default function Md({ text, inline: isInline }: { text: string; inline?: boolean }) {
  return isInline ? (
    <span dangerouslySetInnerHTML={{ __html: inline(text) }} />
  ) : (
    <div className={s.md} dangerouslySetInnerHTML={{ __html: render(text) }} />
  );
}
