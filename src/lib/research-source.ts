export const REDDIT_SUBS = ["pornfree", "NoFap", "semenretention", "PornAddiction"];

export const YT_TOPICS = [
  "how to quit porn addiction",
  "nofap relapse recovery",
  "semen retention discipline",
  "dopamine reset porn addiction",
  "porn withdrawal timeline",
];

export const ARTICLE_SOURCES = [
  "https://www.yourbrainonporn.com/rebooting-accounts/",
  "https://fightthenewdrug.org/get-the-facts/",
  "https://nofap.com/rebooting/",
];

const STRONG_TERMS = [
  "porn",
  "pornography",
  "nofap",
  "semen retention",
  "relapse",
  "masturbation",
  "compulsive sexual",
  "corn",
];

const CONTEXT_TERMS = [
  "addiction",
  "dopamine",
  "withdrawal",
  "urge",
  "recovery",
  "reboot",
  "discipline",
  "habit",
  "accountability",
  "focus",
  "desensitized",
];

function containsAny(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

export function isPornRecoveryRelevant(title: string, body: string = "") {
  const text = `${title}\n${body}`.toLowerCase();
  if (containsAny(text, STRONG_TERMS)) return true;
  return text.includes("sexual") && containsAny(text, CONTEXT_TERMS);
}

export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRedditUrl(url: string): string {
  if (url.startsWith("/")) {
    return `https://www.reddit.com${url}`;
  }
  return url;
}
