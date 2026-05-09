import React, { useCallback, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import { ELementTypes } from '@seafile/seafile-editor';
import { CustomizeMarkdownViewer } from '@/components';
import { gettext } from '@/constants';
import { getInternalNetworkAddress, getResourceIconURL } from '@/project/utils';
import { generatorKnowledgeBaseURL } from '@/project/main-panel/knowledge-base/utils';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import CustomizeDefinition from '@/project/main-panel/ask/chat-history/customize-definition';
import CustomizeLinkReference from '@/project/main-panel/ask/chat-history/customize-link-reference';
import CustomizeLink from '@/project/main-panel/ask/chat-history/customize-link';

const pageOptions = window?.app?.pageOptions || {};

const normalizeSourceURL = (url) => {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).href;
  } catch (e) {
    return url;
  }
};

const normalizeSources = ({ sources, workspaceID, projectName }) => {
  const originSources = Array.isArray(sources) ? sources.slice(0) : [];
  return originSources.map((source, index) => {
    const type = source?.type || 'unknown';
    const connectionID = source?.connection_id;
    const recordID = source?._id ?? index;
    const title = String(source?.title || source?.url || gettext('Unknown')).replaceAll('"', '\'');

    let url = '';
    if (source?.url && type === 'unknown') {
      url = normalizeSourceURL(source.url);
    } else {
      url = normalizeSourceURL(getInternalNetworkAddress(type, recordID, { workspaceID, projectName, connectionID }));
    }

    return {
      key: `${type}_${connectionID || ''}_${recordID}`,
      _id: recordID,
      type,
      icon: getResourceIconURL(type),
      url,
      connection_id: connectionID,
      title,
      content: source?.ai_summary || source?.content || '',
      mtime: source?.bumped_at || source?.mtime || source?.updated_at || source?.modified_time || '',
      filename: source?.filename,
      path: source?.path,
      slug: source?.slug,
      topic_id: source?.topic_id,
    };
  });
};

const AIReferenceMarkdown = forwardRef(({
  value = '',
  sources: rawSources = [],
  projectUuid,
  workspaceID: propsWorkspaceID,
  projectName: propsProjectName,
  showTOC = false,
  isShowLoading = true,
  beforeRenderCallback,
  canPreviewLinkedFile = true,
  hideRawReferenceMarkers = false,
}, ref) => {
  const workspaceID = propsWorkspaceID || pageOptions.workspaceID;
  const projectName = propsProjectName || pageOptions.projectName;
  const [isShowResourceDetails, setIsShowResourceDetails] = useState(false);
  const [resource, setResource] = useState(null);

  const normalizedSources = useMemo(() => {
    return normalizeSources({ sources: rawSources, workspaceID, projectName });
  }, [rawSources, workspaceID, projectName]);

  const { markdownValue, markdownCopyValue, sources, mdFiles } = useMemo(() => {
    let content = value || '';
    let aiReplyForCopy = content || '';
    const sourcesInReply = normalizedSources.map((source) => ({ ...source }));
    const files = [];

    if (!content) {
      return {
        markdownValue: '',
        markdownCopyValue: '',
        sources: sourcesInReply,
        mdFiles: files,
      };
    }

    const mdRegex = /<seaqa-markdown(?:\s+file_name=(["'])([^"']*?)\1)?\s*>([\s\S]*?)<\/seaqa-markdown>/g;
    content = content.replace(mdRegex, (...replaceArgs) => {
      const fileName = replaceArgs[2];
      const mdContent = replaceArgs[3];
      const validFileName = fileName || 'analysis.md';
      const urlObject = new URL(`file:///sea-ticket/${validFileName}`);
      const fileURL = urlObject.href;
      files.push({
        name: validFileName,
        url: fileURL,
        content: mdContent.trimStart(),
      });
      return `[${validFileName}](${fileURL})`;
    });

    const kbEntryRegex = /<seaqa-kb-entry\s+id=(?:["'])(\d+)(?:["'])\s+title=(?:["'])(.*?)(?:["'])\s*\/>/g;
    content = content.replace(kbEntryRegex, (...replaceArgs) => {
      const kbID = replaceArgs[1];
      const title = replaceArgs[2];
      const kbUrl = generatorKnowledgeBaseURL({ kb: { _id: kbID }, workspaceID, projectName });
      return `[${title}](${kbUrl})`;
    });

    if (hideRawReferenceMarkers) {
      const referenceXRegex = /<reference_(\d+)>/g;
      content = content.replace(referenceXRegex, '');
    }

    if (Array.isArray(sourcesInReply) && sourcesInReply.length > 0) {
      const referenceMarkString = 'Reference|Source|Document|Documents|Docs|Doc';
      const referenceMark = new RegExp(`(${referenceMarkString})\\s*`, 'gi');
      const normalizeRefRegex = new RegExp(`([\\[\\(])(${referenceMarkString})\\s*(\\d+(?:\\s*,\\s*(?:\\d+|(?:${referenceMarkString})\\s*\\d+))*)\\s*([\\]\\)])`, 'gi');
      const formatReference = /\[Reference\s*(\d+)\]\((https?:\/\/[^\s]+)\)/gi;
      const removeParentheses = /\((\[Reference \d+\](?:, \[Reference \d+\])*)(\))/gi;
      const removeComma = /(\[Reference\s+\d+\](?:\s*,\s*\[Reference\s+\d+\])+)/g;
      const reference2Md = /\[(Reference)\s+(\d+)\]/g;

      content = content
        .replace(normalizeRefRegex, (...replaceArgs) => {
          const ordersPart = replaceArgs[3];
          const orders = ordersPart.split(',').map(orderPart => {
            return orderPart.replace(referenceMark, '').trim();
          }).filter(num => num !== '');
          return orders.map(order => ` [Reference ${order}]`).join('');
        })
        .replace(formatReference, (match, order, linkReference) => {
          if (!linkReference) return ` [Reference ${order}]`;
          const linkReferenceIncludesParentheses = linkReference.endsWith(')');
          const validLinkReference = linkReferenceIncludesParentheses ? linkReference.slice(0, -1) : linkReference;
          const url = normalizeSourceURL(validLinkReference);
          const sourceIndex = sourcesInReply.findIndex(source => source.url === url);
          if (sourceIndex > -1) return ` [Reference ${sourceIndex + 1}]${linkReferenceIncludesParentheses ? ')' : ''}`;

          const referenceIndex = sourcesInReply.length + 1;
          sourcesInReply.push({
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
          return ` [Reference ${referenceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
        })
        .replaceAll(removeParentheses, (...replaceArgs) => replaceArgs[1])
        .replace(removeComma, (match) => match.replace(/\],\s*\[/g, ']['))
        .replace(reference2Md, (...replaceArgs) => {
          const orderString = replaceArgs[2];
          const order = Number(orderString);
          const source = sourcesInReply[order - 1];
          if (!source) return '';
          return ` [${source.title}][${order}]`;
        });

      aiReplyForCopy = content.slice(0);
      files.forEach(file => {
        const { url, name, content } = file;
        aiReplyForCopy = aiReplyForCopy.replace(`[${name}](${url})`, `\n\`\`\`markdown filename=${name} \n${content}\n\`\`\``);
      });
      sourcesInReply.forEach((source, index) => {
        aiReplyForCopy = aiReplyForCopy.replaceAll(` [${source.title}][${index + 1}]`, '');
      });

      const sourcesString = sourcesInReply.map((source, index) => `[${index + 1}]: ${source.url} "${source.title}"`).join('\n');
      content = content + `\n\n${sourcesString}`;
    } else {
      aiReplyForCopy = content;
    }

    return {
      markdownValue: content,
      markdownCopyValue: aiReplyForCopy,
      sources: sourcesInReply,
      mdFiles: files,
    };
  }, [value, normalizedSources, workspaceID, projectName, hideRawReferenceMarkers]);

  const handleConnectionRecord = useCallback((record) => {
    setResource(record);
    setIsShowResourceDetails(true);
  }, []);

  const openConnectionRecord = useCallback((_event, record) => {
    handleConnectionRecord(record);
  }, [handleConnectionRecord]);

  const closeConnectionRecord = useCallback(() => {
    setResource(null);
    setIsShowResourceDetails(false);
  }, []);

  const switchResource = useCallback((step) => {
    if (!resource || !Array.isArray(sources) || sources.length === 0) return;
    const index = sources.findIndex(r => r.key === resource.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > sources.length - 1) newIndex = 0;
    if (newIndex < 0) newIndex = sources.length - 1;
    handleConnectionRecord(sources[newIndex]);
  }, [sources, resource, handleConnectionRecord]);

  const options = useMemo(() => {
    return {
      loading: {
        render: (() => null)()
      },
      [ELementTypes.DEFINITION]: {
        render: (<CustomizeDefinition sources={sources} openDefinitionRecord={openConnectionRecord} />)
      },
      [ELementTypes.LINK_REFERENCE]: {
        render: (<CustomizeLinkReference />)
      },
      [ELementTypes.LINK]: {
        render: (<CustomizeLink canPreviewLinkedFile={canPreviewLinkedFile} mdFiles={mdFiles} />)
      }
    };
  }, [sources, mdFiles, canPreviewLinkedFile, openConnectionRecord]);

  useImperativeHandle(ref, () => ({
    getAIReply: () => markdownCopyValue,
  }), [markdownCopyValue]);

  return (
    <>
      {markdownValue && (
        <CustomizeMarkdownViewer
          value={markdownValue}
          showTOC={showTOC}
          isShowLoading={isShowLoading}
          options={options}
          beforeRenderCallback={beforeRenderCallback}
          onDefinitionClick={openConnectionRecord}
        />
      )}
      {isShowResourceDetails && (
        <ResourceDetailsDialog
          projectUuid={projectUuid}
          resource={resource}
          isShowIcon={true}
          switchResource={sources.length > 1 ? switchResource : null}
          onToggle={closeConnectionRecord}
        />
      )}
    </>
  );
});

export default AIReferenceMarkdown;
