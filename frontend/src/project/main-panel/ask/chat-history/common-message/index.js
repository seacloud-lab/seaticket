import React, { Fragment, useCallback, useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { CustomizeMarkdownViewer } from '@/components';
import { gettext } from '@/constants';
import ThoughtProcess from '../thought-process';

import './index.css';

const CommonMessage = forwardRef(({ message }, ref) => {
  const contentRef = useRef(null);

  const [answerType, setAnswerType] = useState('rich-text');

  const answer = useMemo(() => {
    if (Object.keys(message).length === 0) return '';
    let value = message[CHAT_MESSAGE_TYPE.ANSWER];
    const originSources = message[CHAT_MESSAGE_TYPE.SOURCES];
    let sources = Array.isArray(originSources) ? originSources.slice(0) : [];
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
          const sourceIndex = sources.findIndex(source => source.url === validLinkReference);
          if (sourceIndex > -1) return `[Reference ${sourceIndex}]${linkReferenceIncludesParentheses ? ')' : ''}`;
          sources.push({ title: validLinkReference, url: validLinkReference });
          return `[Reference ${sources.length}]${linkReferenceIncludesParentheses ? ')' : ''}`;
        })
        .replaceAll(removeParentheses, (match, p1) => p1)
        .replace(removeComma, (match) => match.replace(/\],\s*\[/g, ']['))
        .replace(reference2Md, (match, text, orderString) => {
          const order = Number(orderString);
          const source = sources[order - 1];
          if (!source) return '';
          return `[${source.title || source.url}][${order}]`;
        });
      const sourcesString = sources.map((s, i) => `[${i + 1}]: ${s.url} "${s.title}"`).join('\n');
      value = value + `\n## ${gettext('Sources')}\n${sourcesString}` ;
    }
    return value;
  }, [message]);

  const beforeAnswerRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAnswerType('text');
    }
  }, []);

  useImperativeHandle(ref, () => ({

    getHTML: () => {
      if (!answer) return '';
      return contentRef.current.innerHTML;
    },

    getAnswer: () => answer,
  }), [message, answer, contentRef]);

  return (
    <div className="sea-qa-ai-ask-message-content" ref={contentRef}>
      <ThoughtProcess value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]} />
      {message[CHAT_MESSAGE_TYPE.TEXT] && (<>{message[CHAT_MESSAGE_TYPE.TEXT]}</>)}
      {answer && (
        <div className={classnames('sea-qa-ai-ask-message-answer', answerType)}>
          <CustomizeMarkdownViewer value={answer} showTOC={false} beforeRenderCallback={beforeAnswerRenderCallback} />
        </div>
      )}
    </div>
  );

});

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
