import React, { Fragment, useCallback, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { ELementTypes } from '@seafile/seafile-editor';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { CustomizeMarkdownViewer, LinkVerifiedDialog } from '@/components';
import ThoughtProcess from '../thought-process';
import CustomizeDefinition from '../customize-definition';
import CustomizeLinkReference from '../customize-link-reference';
import RowDetailsDialog from '@/project/main-panel/connections/components/row-details-dialog';
import { getConnectionIcon } from '@/project/main-panel/connections/utils';
import { getNumberDisplayString } from '@/sea-metadata/utils/column';
import { SUPPORT_ROW_DETAILS_CONNECTION_TYPES } from '../../../connections/constants';
import { gettext } from '@/constants';

import './index.css';

const CommonMessage = forwardRef(({ message, settings, projectUuid, projectName, workspaceID }, ref) => {
  const contentRef = useRef(null);

  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [isShowConnectionRecord, setIsShowConnectionRecord] = useState(false);
  const [currentConnectionRecord, setCurrentConnectionRecord] = useState(null);
  const [currentConnection, setCurrentConnection] = useState(null);
  const [isShowLinkVerifiedDialog, setIsShowLinkVerifiedDialog] = useState(false);

  const columns = useMemo(() => {
    return [
      { key: 'filename', name: 'filename' },
      { key: 'title', name: 'title' },
      { key: 'url', name: 'url' },
    ];
  }, []);

  const { aiReply, sources } = useMemo(() => {
    if (Object.keys(message).length === 0) return '';
    let value = message[CHAT_MESSAGE_TYPE.AI_REPLY];

    if (Object.keys(message).length === 0) return [];
    let originSources = message[CHAT_MESSAGE_TYPE.SOURCES];
    originSources = Array.isArray(originSources) ? originSources.slice(0) : [];
    let sources = originSources.map(source => {
      const { type, connection_name, url, content_preview, bumped_at, mtime, updated_at, score, connection_id, _id, title } = source;
      let validURL = url || '';
      if (!validURL) {
        validURL = location.origin + '/workspace/' + workspaceID + '/project/' + projectName + '/connections/' + connection_id + '/';
      }
      const urlObject = new URL(validURL);

      return {
        type,
        connection_id,
        connection_record_id: _id,
        icon: getConnectionIcon(type),
        connection_name: connection_name,
        url: urlObject.href,
        title: title.replaceAll('"', '\''),
        content: content_preview,
        mtime: bumped_at || mtime || updated_at || '',
        score: getNumberDisplayString(score, { format: 'number', enable_precision: true, precision: 2 }),
      };
    });

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
            title: url,
            url: url,
            connection_id: `unknown_${referenceIndex}`,
            _id: referenceIndex,
            type: 'unknown',
            content: validLinkReference + '',
            icon: getConnectionIcon('unknown'),
            connection_name: gettext('Unknown')
          });
          return `[Reference ${referenceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
        })
        .replaceAll(removeParentheses, (match, p1) => p1)
        .replace(removeComma, (match) => match.replace(/\],\s*\[/g, ']['))
        .replace(reference2Md, (match, text, orderString) => {
          const order = Number(orderString);
          const source = sources[order - 1];
          if (!source) return '';
          return `[${source.title}][${order}]`;
        });
      const sourcesString = sources.map((s, i) => `[${i + 1}]: ${s.url} "${s.title}"`).join('\n');
      value = value + `\n\n${sourcesString}` ;
    }
    return { aiReply: value, sources };
  }, [message, projectName, workspaceID]);

  const openConnectionRecord = useCallback((event, connectionInfo) => {
    setCurrentConnection({ type: connectionInfo.type, id: connectionInfo.connection_id });
    setCurrentConnectionRecord({
      _id: connectionInfo.connection_record_id,
      title: connectionInfo.title,
      connection_id: connectionInfo.connection_id,
      url: connectionInfo.url,
    });
    setIsShowConnectionRecord(true);
  }, []);

  const closeConnectionRecord = useCallback(() => {
    setCurrentConnectionRecord(null);
    setIsShowConnectionRecord(false);
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
      }
    };
  }, [sources, settings, openConnectionRecord]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    }
  }, []);

  const switchRow = useCallback((step) => {
    const index = sources.findIndex(r => r.connection_record_id === currentConnectionRecord._id && r.connection_id === currentConnectionRecord.connection_id);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > sources.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = sources.length - 1;
    }
    const currentRow = sources[newIndex];
    if (SUPPORT_ROW_DETAILS_CONNECTION_TYPES.includes(currentRow.type)) {
      setCurrentConnectionRecord({ _id: currentRow.connection_record_id, title: currentRow.title, connection_id: currentRow.connection_id, url: currentRow.url });
      setCurrentConnection({ type: currentRow.type, id: currentRow.connection_id });
      return;
    }
    setIsShowConnectionRecord(false);
    setCurrentConnectionRecord({ _id: currentRow.connection_record_id, title: currentRow.title, connection_id: currentRow.connection_id, url: currentRow.url });
    setIsShowLinkVerifiedDialog(true);
  }, [sources, currentConnectionRecord]);

  useImperativeHandle(ref, () => ({

    getHTML: () => {
      if (!aiReply) return '';
      return contentRef.current.innerHTML;
    },

    getAIReply: () => aiReply,
  }), [message, aiReply, contentRef]);

  return (
    <>
      <div className="sea-qa-ai-ask-message-content" ref={contentRef}>
        <ThoughtProcess value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]} />
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
      {isShowConnectionRecord && (
        <RowDetailsDialog
          projectUuid={projectUuid}
          connection={currentConnection}
          row={currentConnectionRecord}
          columns={columns}
          switchRow={switchRow}
          onToggle={closeConnectionRecord}
        />
      )}
      {isShowLinkVerifiedDialog && (
        <LinkVerifiedDialog link={currentConnectionRecord.url} onToggle={() => setIsShowLinkVerifiedDialog(false)} />
      )}
    </>
  );

});

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
