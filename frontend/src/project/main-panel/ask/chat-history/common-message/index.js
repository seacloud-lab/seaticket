import React, { Fragment, useCallback, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { ELementTypes } from '@seafile/seafile-editor';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { CustomizeMarkdownViewer, LinkVerifiedDialog } from '@/components';
import ThoughtProcess from '../thought-process';
import CustomizeDefinition from '../customize-definition';
import CustomizeLinkReference from '../customize-link-reference';
import CustomizeLink from '../customize-link';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { getNumberDisplayString } from '@/sea-metadata/utils/column';
import { gettext } from '@/constants';
import { Attachments } from '../../components';
import { getResourceIconURL, getResourceURL } from '@/project/utils';
import { TICKET_TYPE } from '@/project/main-panel/tickets/constants';
import { KNOWLEDGE_BASE_TYPE } from '@/project/main-panel/knowledge-base/constants';
import { useConnections } from '@/project/main-panel/connections/hooks';

import './index.css';

const CommonMessage = forwardRef(({ chatId, message, settings, projectUuid, projectName, workspaceID }, ref) => {
  const contentRef = useRef(null);

  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [isShowResourceDetails, setIsShowResourceDetails] = useState(false);
  const [resource, setResource] = useState(null);
  const [isShowLinkVerifiedDialog, setIsShowLinkVerifiedDialog] = useState(false);

  const { connections } = useConnections();

  const { aiReply, aiReplyForCopy, sources, mdFiles } = useMemo(() => {
    if (Object.keys(message).length === 0) return { aiReply: '', sources: [], mdFiles: [] };
    let value = message[CHAT_MESSAGE_TYPE.AI_REPLY];

    let originSources = message[CHAT_MESSAGE_TYPE.SOURCES];
    originSources = Array.isArray(originSources) ? originSources.slice(0) : [];
    let sources = originSources.map(source => {
      const { type, ai_summary, score, connection_id, _id, title } = source;
      const url = getResourceURL(type, _id, { url: source?.url, workspaceID, projectName, connectionID: connection_id });
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
      const mdRegex = /<seaqa-markdown(?:\s+file_name="([^"]*)")?\s*>([\s\S]*?)<\/seaqa-markdown>/g;
      value = value
        .replace(mdRegex, (match, fileName, content) => {
          const urlObject = new URL(`file:///sea-ticket/${fileName}?t=${chatId}`);
          const url = urlObject.href;
          mdFiles.push({
            name: fileName,
            url,
            content: content.trimStart(),
          });
          return `[${fileName}](${url})`;
        });
    }

    if (value && sources.length > 0) {
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
      value = value + `\n\n${sourcesString}` ;
    }
    let aiReplyForCopy = value;
    mdFiles.forEach(file => {
      const { url, name } = file;
      aiReplyForCopy = aiReplyForCopy.replace(`[${name}](${url})`, `\n${name}\n`);
    });
    return { aiReply: value, aiReplyForCopy, sources, mdFiles };
  }, [message, projectName, workspaceID, chatId]);

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
        render: (<CustomizeDefinition sources={sources} settings={settings} openDefinitionRecord={openConnectionRecord} />)
      },
      [ELementTypes.LINK_REFERENCE]: {
        render: (<CustomizeLinkReference />)
      },
      [ELementTypes.LINK]: {
        render: (<CustomizeLink mdFiles={mdFiles} />)
      }
    };
  }, [sources, mdFiles, settings, openConnectionRecord]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
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

    getHTML: () => {
      if (!aiReply) return '';
      return contentRef.current.innerHTML;
    },

    getAIReply: () => aiReplyForCopy,
  }), [message, aiReply, aiReplyForCopy, contentRef]);

  return (
    <>
      <Attachments attachments={message[CHAT_MESSAGE_TYPE.ATTACHMENTS]} projectUuid={projectUuid} />
      <div className="sea-qa-ai-ask-message-content" ref={contentRef}>
        <ThoughtProcess value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]} settings={settings} />
        {message[CHAT_MESSAGE_TYPE.TEXT] && (<>{message[CHAT_MESSAGE_TYPE.TEXT]}</>)}
        {aiReply && (
          <div className={classnames('sea-qa-message-ai-reply', aiMessageType)}>
            <CustomizeMarkdownViewer
              value={aiReply}
              showTOC={false}
              options={options}
              beforeRenderCallback={beforeAIReplyRenderCallback}
              onDefinitionClick={openConnectionRecord}
            />
          </div>
        )}
      </div>
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

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
