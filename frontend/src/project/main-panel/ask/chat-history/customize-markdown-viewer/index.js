import React, { useCallback, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import classnames from 'classnames';
import { ELementTypes } from '@seafile/seafile-editor';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { CustomizeMarkdownViewer as CustomizeMarkdownViewerComponent, LinkVerifiedDialog } from '@/components';
import CustomizeDefinition from '../customize-definition';
import CustomizeLinkReference from '../customize-link-reference';
import CustomizeLink from '../customize-link';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { getNumberDisplayString } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import { getResourceIconURL, getInternalNetworkAddress } from '@/project/utils';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';

import './index.css';

const CustomizeMarkdownViewer = forwardRef(({ chatId, message, projectUuid, projectName, workspaceID, className: propsClassName, canPreviewLinkedFile = true }, ref) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [className, setClassName] = useState('');
  const [isShowResourceDetails, setIsShowResourceDetails] = useState(false);
  const [resource, setResource] = useState(null);
  const [isShowLinkVerifiedDialog, setIsShowLinkVerifiedDialog] = useState(false);

  const { connections } = useConnections();

  const { aiReply, aiReplyForCopy, sources, mdFiles } = useMemo(() => {
    if (Object.keys(message).length === 0) return { aiReply: '', sources: [], mdFiles: [] };
    let value = message[CHAT_MESSAGE_TYPE.AI_REPLY];
    let aiReplyForCopy = '';

    let originSources = message[CHAT_MESSAGE_TYPE.SOURCES];
    originSources = Array.isArray(originSources) ? originSources.slice(0) : [];
    let sources = originSources.map(source => {
      const { type, ai_summary, score, connection_id, _id, title } = source;
      const url = getInternalNetworkAddress(type, _id, { workspaceID, projectName, connectionID: connection_id });
      const urlObject = new URL(url);
      let category_name = '';
      if (type === TICKET_TYPE) {
        category_name = gettext('Tickets');
      } else if (type === KNOWLEDGE_BASE_TYPE) {
        category_name = gettext('Knowledge base');
      } else {
        const connection = connections.find(c => c.id === connection_id);
        category_name = connection?.name || gettext('Deleted connection');
      }

      return {
        key: `${type}_${connection_id || ''}_${_id}`,
        _id,
        type,
        icon: getResourceIconURL(type),
        url: urlObject.href,
        connection_id,
        category_name,
        title: title.replaceAll('"', '\''),
        content: ai_summary,
        mtime: source?.bumped_at || source?.mtime || source?.updated_at || source?.modified_time || '',
        score: getNumberDisplayString(score, { format: 'number', enable_precision: true, precision: 2 }),
        filename: source.filename,
        path: source.path,
        slug: source.slug,
        topic_id: source?.topic_id,
      };
    });
    let mdFiles = [];
    if (value) {
      const mdRegex = /<seaqa-markdown(?:\s+file_name=(["'])([^"']*?)\1)?\s*>([\s\S]*?)<\/seaqa-markdown>/g;
      value = value
        .replace(mdRegex, (match, quotationType, fileName, content) => {
          const urlObject = new URL(`file:///sea-ticket/${fileName}?t=${chatId}`);
          const url = urlObject.href;
          mdFiles.push({
            name: fileName,
            url,
            content: content.trimStart(),
          });
          return `[${fileName}](${url})`;
        });
      aiReplyForCopy = value;
    }

    if (value && Array.isArray(sources) && sources.length > 0) {
      const referenceMarkString = 'Reference|Source|Document|Documents|Docs|Doc';
      const referenceMark = new RegExp(`(${referenceMarkString})\\s*`, 'gi');

      // [referenceMarkString n] => [Reference n]
      // (Documents 4, 9, 12) ==> [Reference 4][Reference 9][Reference 12]
      const regex = new RegExp(`([\\[\\(])(${referenceMarkString})\\s*(\\d+(?:\\s*,\\s*(?:\\d+|(?:${referenceMarkString})\\s*\\d+))*)\\s*([\\]\\)])`, 'gi');

      // [Reference 1](url) => [Reference 1]
      const formatReference = /\[Reference\s*(\d+)\]\((https?:\/\/[^\s]+)\)/gi;

      // ([Reference 1]) => [Reference 1]
      // ([Reference 1], [Reference 2]) => [Reference 1], [Reference 2]
      const removeParentheses = /\((\[Reference \d+\](?:, \[Reference \d+\])*)(\))/gi;

      // [Reference 1], [Reference 2], [Reference 3] => [Reference 1][Reference 2][Reference 3]
      const removeComma = /(\[Reference\s+\d+\](?:\s*,\s*\[Reference\s+\d+\])+)/g;

      // [Reference 1] => [Source title][1]
      const reference2Md = /\[(Reference)\s+(\d+)\]/g;

      value = value
        .replace(regex, (match, openBracket, refType, ordersPart, closeBracket) => {
          const orders = ordersPart.split(',').map(orderPart => {
            return orderPart.replace(referenceMark, '').trim();
          }).filter(num => num !== '');
          return orders.map(order => ` [Reference ${order}]`).join('');
        })
        .replace(formatReference, (match, order, linkReference) => {
          if (!linkReference) return ` [Reference ${order}]`;
          const linkReferenceIncludesParentheses = linkReference.endsWith(')');
          const validLinkReference = linkReferenceIncludesParentheses ? linkReference.slice(0, -1) : linkReference;
          const urlObject = new URL(validLinkReference);
          const url = urlObject.href;
          const sourceIndex = sources.findIndex(source => source.url === url);
          if (sourceIndex > -1) return ` [Reference ${sourceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
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
          return ` [Reference ${referenceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
        })
        .replaceAll(removeParentheses, (match, p1) => p1)
        .replace(removeComma, (match) => match.replace(/\],\s*\[/g, ']['))
        .replace(reference2Md, (match, text, orderString) => {
          const order = Number(orderString);
          const source = sources[order - 1];
          if (!source) return '';
          return ` [${source.title}][${order}]`;
        });
      const sourcesString = sources.map((s, i) => `[${i + 1}]: ${s.url} "${s.title}"`).join('\n');
      aiReplyForCopy = value.slice(0);
      mdFiles.forEach(file => {
        const { url, name, content } = file;
        aiReplyForCopy = aiReplyForCopy.replace(`[${name}](${url})`, `\n\`\`\`markdown filename=${name} \n${content}\n\`\`\``);
      });
      sources.forEach((source, index) => {
        aiReplyForCopy = aiReplyForCopy.replaceAll(` [${source.title}][${index + 1}]`, '');
      });

      value = value + `\n\n${sourcesString}`;
    }

    return {
      aiReply: value,
      aiReplyForCopy,
      sources,
      mdFiles,
    };
  }, [message, projectName, workspaceID, chatId, connections]);

  const handleConnectionRecord = useCallback((record) => {
    setResource(record);
    setIsShowResourceDetails(true);
  }, []);

  const openConnectionRecord = useCallback((event, record) => {
    handleConnectionRecord(record);
  }, [handleConnectionRecord]);

  const closeConnectionRecord = useCallback(() => {
    setResource(null);
    setIsShowResourceDetails(false);
  }, []);

  const options = useMemo(() => {
    return {
      'loading': {
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

  const beforeAIReplyRenderCallback = useCallback((value) => {
    const valueCount = value.length;
    if (valueCount === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    } else {
      setAIMessageType('rich-text');
    }
    const lastDom = value[valueCount - 1];
    if (lastDom.type === 'paragraph' && lastDom.children.length > 2) {
      const last2Child = lastDom.children[lastDom.children.length - 2];
      if (last2Child.type === 'link' && last2Child.url.startsWith('file:///sea-ticket/')) {
        setClassName('ends-with-link');
      }
    }
  }, []);

  const switchResource = useCallback((step) => {
    const index = sources.findIndex(r => r.key === resource.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > sources.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = sources.length - 1;
    }
    const currentRow = sources[newIndex];
    handleConnectionRecord(currentRow);
  }, [sources, resource, handleConnectionRecord]);

  useImperativeHandle(ref, () => ({
    getAIReply: () => aiReplyForCopy,
  }), [aiReplyForCopy]);

  return (
    <>
      {aiReply && (
        <div className={classnames('sea-qa-message-ai-reply', aiMessageType, className, propsClassName)}>
          <CustomizeMarkdownViewerComponent
            value={aiReply}
            showTOC={false}
            isShowLoading={chatId?.startsWith('typing') && chatId === 'typing' ? false : true}
            options={options}
            beforeRenderCallback={beforeAIReplyRenderCallback}
            onDefinitionClick={openConnectionRecord}
          />
        </div>
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
      {isShowLinkVerifiedDialog && (
        <LinkVerifiedDialog link={resource.url} onToggle={() => setIsShowLinkVerifiedDialog(false)} />
      )}
    </>
  );

});

export default CustomizeMarkdownViewer;
