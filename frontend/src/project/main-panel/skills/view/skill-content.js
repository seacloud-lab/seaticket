export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;
export const SKILL_HEADER_SEPARATOR = '====================';

export function extractSkillBody(content) {
  const text = String(content || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const index = text.indexOf(SKILL_HEADER_SEPARATOR);
  if (index === -1) {
    return text;
  }
  return text.slice(index + SKILL_HEADER_SEPARATOR.length).replace(/^\n+/, '');
}

export function composeSkillContent({ name, description, supportAgent, body }) {
  const lines = [
    `name: ${String(name || '').trim()}`,
    `description: ${JSON.stringify(String(description || '').trim())}`,
  ];
  if (supportAgent) {
    lines.push('support_agent: true');
  }
  lines.push(
    SKILL_HEADER_SEPARATOR,
    '',
  );
  const normalizedBody = `${String(body || '').replace(/^\r?\n+/, '').trimEnd()}\n`;
  return `${lines.join('\n')}\n${normalizedBody}`;
}
