// Small text-matching utilities used to score pronunciation attempts against a target phrase.

export function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents so "está"~"esta" still counts as close
    .replace(/[¿?¡!.,;:]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

// 0-100 similarity score based on normalized Levenshtein distance.
export function similarity(target, attempt) {
  const a = normalize(target);
  const b = normalize(attempt);
  if (!a.length && !b.length) return 100;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return Math.round((1 - dist / maxLen) * 100);
}

// Word-level diff so the UI can highlight which words matched vs. didn't.
export function wordDiff(target, attempt) {
  const targetWords = normalize(target).split(" ").filter(Boolean);
  const attemptWords = new Set(normalize(attempt).split(" ").filter(Boolean));
  return targetWords.map((w) => ({ word: w, matched: attemptWords.has(w) }));
}

export function scoreLabel(score) {
  if (score >= 90) return { label: "¡Perfecto!", tone: "great" };
  if (score >= 70) return { label: "Sehr gut", tone: "good" };
  if (score >= 45) return { label: "Geht so", tone: "ok" };
  return { label: "Nochmal versuchen", tone: "retry" };
}
