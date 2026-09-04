import sanitizeHtml from "sanitize-html";

function decodeEntities(html: string): string {
  return html
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

export function sanitizeJobHtml(html: string): string {
  return sanitizeHtml(decodeEntities(html), {
    allowedTags: [
      "p",
      "br",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "i",
      "h2",
      "h3",
      "h4",
      "h5",
      "blockquote",
      "code",
      "pre",
      "span",
      "div",
    ],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}
