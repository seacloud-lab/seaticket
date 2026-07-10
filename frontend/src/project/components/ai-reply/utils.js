import { gettext } from '@/constants';
import { getResourceIconURL, getInternalNetworkAddress } from '@/project/utils';
import { generatorKnowledgeBaseURL } from '@/project/main-panel/knowledge-base/utils';

export const formatSources = (sources, { workspaceID, projectName }) => {
  if (!Array.isArray(sources) || sources.length === 0) return [];
  return sources.slice(0).map(source => {
    const { type, ai_summary, connection_id, _id, title } = source;
    const url = !type || type === 'unknown' ? source?.url : getInternalNetworkAddress(type, _id, { workspaceID, projectName, connectionID: connection_id });
    const urlObject = url ? new URL(url) : { href: '' };

    return {
      key: `${type}_${connection_id || ''}_${_id}`,
      _id,
      type,
      icon: getResourceIconURL(type),
      url: urlObject.href,
      connection_id,
      title: title ? title.replaceAll('"', '\'') : ' ',
      content: ai_summary,
      mtime: source?.bumped_at || source?.mtime || source?.updated_at || source?.modified_time || '',
      filename: source.filename,
      path: source.path,
      slug: source.slug,
      topic_id: source?.topic_id,
    };
  });
};

export const transformMDFileToLink = (value = '', mdFiles = [], messageId) => {
  if (!value) return value;
  const mdRegex = /<seaqa-markdown(?:\s+file_name=(["'])([^"']*?)\1)?\s*>([\s\S]*?)<\/seaqa-markdown>/g;
  return value
    .replace(mdRegex, (match, quotationType, fileName, content) => {
      const urlObject = new URL(`file:///sea-ticket/${fileName}?t=${messageId}`);
      const url = urlObject.href;
      mdFiles.push({
        name: fileName,
        url,
        content: content.trimStart(),
      });
      return `[${fileName}](${url})`;
    });
};

// Render seaqa-kb-entry as a direct link to the created KB record
export const transformKBToLink = (value, { workspaceID, projectName }) => {
  if (!value) return value;
  const kbEntryRegex = /<seaqa-kb-entry\s+id=(?:["'])(\d+)(?:["'])\s+title=(?:["'])(.*?)(?:["'])\s*\/>/g;
  return value.replace(kbEntryRegex, (match, kbId, title) => {
    const kbUrl = generatorKnowledgeBaseURL({ kb: { _id: kbId }, workspaceID, projectName });
    return `[${title}](${kbUrl})`;
  });
};

export const transformReferencesToMarkdown = (value = '', sources = []) => {
  if (!value || !Array.isArray(sources) || sources.length === 0) return value;
  const referenceMarkString = 'Reference|Source|Document|Documents|Docs|Doc';
  const referenceMark = new RegExp(`(${referenceMarkString})\\s*`, 'gi');

  // [referenceMarkString n] => [Reference n]
  // (Documents 4, 9, 12) ==> [Reference 4][Reference 9][Reference 12]
  const regex = new RegExp(`([\\[\\(])(${referenceMarkString})\\s*(\\d+(?:\\s*,\\s*(?:\\d+|(?:${referenceMarkString})\\s*\\d+))*)\\s*([\\]\\)])`, 'gi');

  // [Reference 1](url) => [Reference 1]
  const formatReference = /\[Reference\s*(\d+)\]\((https?:\/\/[^\s]+)\)/gi;

  // ([Reference 1]) => [Reference 1]
  // ([Reference 1], [Reference 2]) => [Reference 1], [Reference 2]
  const removeParentheses = /\((\[Reference\s+\d+\](?:,*\s+\[Reference\s+\d+\])*)(\))/gi;

  // [Reference 1], [Reference 2], [Reference 3] => [Reference 1][Reference 2][Reference 3]
  const removeComma = /\s*(\[Reference\s+\d+\](?:\s*,\s*\[Reference\s+\d+\])+)/g;

  // [Reference 1] => [Source title][1]
  const reference2Md = /\s*\[(Reference)\s+(\d+)\]/g;

  return String(value)
    .replace(regex, (match, openBracket, refType, ordersPart, closeBracket) => {
      const orders = ordersPart.split(',').map(orderPart => {
        return orderPart.replace(referenceMark, '').trim();
      }).filter(num => num !== '');
      return orders.map(order => `[Reference ${order}]`).join('');
    })
    .replace(formatReference, (match, order, linkReference) => {
      if (!linkReference) return `[Reference ${order}]`;
      const linkReferenceIncludesParentheses = linkReference.endsWith(')');
      const validLinkReference = linkReferenceIncludesParentheses ? linkReference.slice(0, -1) : linkReference;
      const urlObject = new URL(validLinkReference);
      const url = urlObject.href;
      const sourceIndex = sources.findIndex(source => source.url === url);
      if (sourceIndex > -1) return `[Reference ${sourceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
      const referenceIndex = sources.length;
      sources.push({
        key: `unknown_${referenceIndex}`,
        title: url,
        url: url,
        connection_id: `unknown_${referenceIndex}`,
        _id: referenceIndex,
        type: 'unknown',
        content: validLinkReference + '',
        icon: getResourceIconURL('unknown'),
        category_name: gettext('Unknown')
      });
      return `[Reference ${referenceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
    })
    .replace(removeParentheses, (match, p1) => p1)
    .replace(removeComma, (match, references) => references.replace(/\],\s*\[/g, ']['))
    .replace(reference2Md, (match, text, orderString) => {
      const order = Number(orderString);
      const source = sources[order - 1];
      if (!source) return '';
      return `[${source.title}][${order}]`;
    });
};

export const transformContentForCopy = (value, { mdFiles = [], sources = [] } = {}) => {
  let aiReplyForCopy = value.slice(0);
  Array.isArray(mdFiles) && mdFiles.length > 0 && mdFiles.forEach(file => {
    const { url, name, content } = file;
    aiReplyForCopy = aiReplyForCopy.replace(`[${name}](${url})`, `\n\`\`\`markdown filename=${name} \n${content}\n\`\`\``);
  });
  Array.isArray(sources) && sources.length > 0 && sources.forEach((source, index) => {
    aiReplyForCopy = aiReplyForCopy.replaceAll(`[${source.title}][${index + 1}]`, '');
  });
  return aiReplyForCopy;
};
