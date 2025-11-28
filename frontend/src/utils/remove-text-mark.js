export const removeTextHTMLMark = (text) => {
  if (!text) return '';
  return text
    .replace(/<!--[\s\S]*?-->/g, '') // remove notes
    .replace(/<script\b[\s\S]*?<\/script>/gi, '') // remove script
    .replace(/<style\b[\s\S]*?<\/style>/gi, '') // remove style
    // remove incomplete tags
    .replace(/<[a-z][a-z0-9]*\b[^>]*$/gim, '') // remove incomplete line endings
    .replace(/<[a-z][a-z0-9]*\b[^>]*?(?=\s*<|$)/gim, '') // remove incomplete tags at the end of text
    .replace(/<[a-z][a-z0-9]*(?:\s+[a-z][a-z0-9-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^"'\s>]+))?)*\s*\/?>/gi, '') // remove tag and attributes
    .replace(/<[^>]*?$/g, '')
    .replace(/^[^<]*>/g, '')
    .replace(/\b(class|id|style|src|href|alt|title)\s*=\s*(?:"[^"]*"|'[^']*'|[^"'\s>]+)/gi, '')
    .replace(/\b(class|id|style|name|value|type|width|height)\b/gi, '')
    .replace(/<\/?[a-z][\s\S]*?>/gi, '');
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

export const removeTextMark = (text) => {
  if (!text) return '';
  let cleanText = removeTextHTMLMark(text);
  cleanText = removeTextMdMark(cleanText);
  cleanText = removeTextBreakMark(cleanText);
  return cleanText.trim();
};
