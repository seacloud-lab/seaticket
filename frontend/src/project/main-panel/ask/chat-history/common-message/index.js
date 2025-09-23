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
    const sources = message[CHAT_MESSAGE_TYPE.SOURCES];
    if (value && sources.length > 0) {
      const regex0 = /\[((?:Source|Reference|Document) \d+(?:, (?:Source|Reference|Document) \d+)*)\]/g;
      value = value.replace(regex0, (match, content) => content.split(', ').map(item => `[${item}]`).join(''));

      const regex = /\[(Reference|Source|Document)\s+(\d+)\]/g;
      value = value.replace(regex, (match, text, orderString) => {
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
