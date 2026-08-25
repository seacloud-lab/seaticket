// Codec helpers for splitting a SKILL.md document into editable fields
// (name / description come from the parsed API response) and composing it back.
// The backend parser stays the single source of truth; these helpers only
// handle the structural frontmatter delimiters and the raw metadata block.

export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/;

export function splitSkillContent(content) {
  const text = String(content || '').replace(/^\uFEFF/, '');
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: '', body: text };
  }
  return {
    frontmatter: match[1] || '',
    body: (match[2] || '').replace(/^\r?\n/, ''),
  };
}

// Extracts the raw YAML lines under the top-level `metadata:` key, keeping the
// author's formatting and comments intact (a parse->dump round trip would not).
export function extractMetadataText(frontmatter) {
  const lines = String(frontmatter || '').split(/\r?\n/);
  const startIndex = lines.findIndex((line) => /^metadata\s*:/.test(line));
  if (startIndex === -1) return '';
  const inlineValue = lines[startIndex].slice(lines[startIndex].indexOf(':') + 1).trim();
  if (inlineValue) {
    return inlineValue === '{}' ? '' : inlineValue;
  }
  const blockLines = [];
  let lastContentIndex = -1;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      blockLines.push('');
      continue;
    }
    if (!/^\s/.test(line)) break;
    blockLines.push(line.replace(/^ {1,2}/, ''));
    lastContentIndex = blockLines.length - 1;
  }
  if (lastContentIndex === -1) return '';
  return blockLines.slice(0, lastContentIndex + 1).join('\n');
}

// `description` is emitted as a JSON string, which is a valid YAML
// double-quoted scalar, so free text (quotes, colons, newlines) stays safe.
export function composeSkillContent({ name, description, metadataText, body }) {
  const lines = [
    '---',
    `name: ${String(name || '').trim()}`,
    `description: ${JSON.stringify(String(description || '').trim())}`,
  ];
  const metadata = String(metadataText || '').trim();
  if (metadata) {
    lines.push('metadata:');
    metadata.split(/\r?\n/).forEach((line) => {
      lines.push(line.trim() ? `  ${line}` : '');
    });
  }
  lines.push('---', '');
  const normalizedBody = `${String(body || '').replace(/^\r?\n+/, '').trimEnd()}\n`;
  return `${lines.join('\n')}\n${normalizedBody}`;
}
