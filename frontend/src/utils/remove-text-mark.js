export const removeTextHTMLMark = (text) => {
  if (!text) return '';

  // Parse as an inert HTML document instead of trying to remove markup with
  // regular expressions. Regex-based stripping can expose a tag after one
  // replacement creates a new multi-character sequence such as "<script".
  const parsedDocument = new DOMParser().parseFromString(String(text), 'text/html');
  parsedDocument.querySelectorAll('script, style, noscript, template').forEach((element) => {
    element.remove();
  });

  // This helper returns plain text, not HTML. Also remove literal angle
  // brackets (including those decoded from entities) so the result cannot be
  // interpreted as an HTML tag if a caller later inserts it into a document.
  return parsedDocument.body.textContent.replace(/[<>]/g, '');
};

export const removeTextMdMark = (text) => {
  if (!text) return '';
  return text
    .replace(/^#{1,6}\s+/gm, '') // title
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold or i
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/```[\s\S]*?```/g, '') // code block
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (match, alt, url) => {
      return alt ? `${alt}(${url})` : ` ${url} `;
    }) // image
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, text, url) => {
      return text === url ? ` ${url} ` : `${text}(${url})`;
    }) // link
    .replace(/^>\s+/gm, '') // quote
    .replace(/^[\s]*[-*+]\s+/gm, '') // list
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ''); // other
};

export const removeTextBreakMark = (text) => {
  if (!text) return '';
  return text.replace(/\r?\n|\r/g, ' ');
};

export const removeTextMark = (text, isHTML = true) => {
  if (!text) return '';
  let cleanText = isHTML ? removeTextHTMLMark(text) : text;
  cleanText = removeTextMdMark(cleanText);
  cleanText = removeTextBreakMark(cleanText);
  return cleanText.trim();
};
