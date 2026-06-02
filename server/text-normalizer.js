const REPLACEMENTS = [
  ["Ã‚Â°F", "\u00b0F"],
  ["Ã‚Â°C", "\u00b0C"],
  ["Â°F", "\u00b0F"],
  ["Â°C", "\u00b0C"],
  ["Ã‚Â®", "\u00ae"],
  ["Â®", "\u00ae"],
  ["Ã¢â‚¬â„¢", "\u2019"],
  ["Ã¢â‚¬Ëœ", "\u2018"],
  ["Ã¢â‚¬Å“", "\u201c"],
  ["Ã¢â‚¬Â", "\u201d"],
  ["Ã¢â‚¬â€œ", "\u2013"],
  ["Ã¢â‚¬â€", "\u2014"],
  ["â€™", "\u2019"],
  ["â€˜", "\u2018"],
  ["â€œ", "\u201c"],
  ["â€", "\u201d"],
  ["â€“", "\u2013"],
  ["â€”", "\u2014"],
  ["â€¦", "\u2026"],
  ["â", "\u2019"],
  ["â", "\u2018"],
  ["â", "\u201c"],
  ["â", "\u201d"],
  ["â", "\u2013"],
  ["â", "\u2014"],
  ["â¦", "\u2026"]
];

function mojibakeScore(value) {
  return (String(value).match(/[ÃÂâ�\u0080-\u009f]/g) ?? []).length;
}

function repairUtf8Mojibake(value) {
  const text = String(value ?? "");
  if (!/[ÃÂâ\u0080-\u009f]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from([...text].map(char => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return !decoded.includes("\ufffd") && mojibakeScore(decoded) < mojibakeScore(text) ? decoded : text;
  } catch {
    return text;
  }
}

function applyKnownReplacements(value) {
  let text = String(value ?? "");
  for (const [bad, good] of REPLACEMENTS) {
    text = text.split(bad).join(good);
  }
  return text;
}

export function cleanText(value) {
  let text = applyKnownReplacements(value);
  text = applyKnownReplacements(repairUtf8Mojibake(text)).normalize("NFKC");

  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
