import React, { Fragment, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '../../../../constants';
import { CustomizeMarkdownViewer } from '../../../../../components';
import { gettext } from '../../../../../constants';

import './index.css';

const CommonMessage = ({ messages }) => {
  const ref = useRef(null);

  const [answerType, setAnswerType] = useState('rich-text');

  const beforeAnswerRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAnswerType('text');
    }
  }, []);

  if (!Array.isArray(messages) || messages.length === 0) return null;
  return (
    <div className="sea-qa-ai-ask-message-content" ref={ref}>
      {messages.map((message, messageIndex) => {
        const messageType = Object.prototype.toString.call(message).slice(8, -1);
        if (messageType === 'String') return (<Fragment key={`sea-qa-ai-ask-message-${messageIndex}`}>{message}</Fragment>);
        if (messageType === 'Object') {
          const { type, value } = message;
          if (type === CHAT_MESSAGE_TYPE.TEXT) return (<Fragment key={`sea-qa-ai-ask-message-${messageIndex}`}>{value}</Fragment>);
          if (type === CHAT_MESSAGE_TYPE.ANSWER) {
            return (
              <div className={classnames('sea-qa-ai-ask-message-answer', answerType)} key={`sea-qa-ai-ask-message-${messageIndex}`}>
                <CustomizeMarkdownViewer value={value} showTOC={false} beforeRenderCallback={beforeAnswerRenderCallback} />
              </div>
            );
          }
          if (type === CHAT_MESSAGE_TYPE.SOURCES && value.length > 0) {
            return (
              <div className="sea-qa-ai-ask-message-sources" key={`sea-qa-ai-ask-message-${messageIndex}`}>
                <h2 className="sea-qa-ai-ask-message-sources-title">{gettext('Sources')}</h2>
                <div className="sea-qa-ai-ask-message-sources-container w-100">
                  {value.map((v, index) => {
                    return (
                      <div className="sea-qa-ai-ask-message-source" key={index} title={v.title}>
                        <div className="mr-2">{`[${index}]`}</div>
                        <a href={v.url}>{v.title}</a>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        }
        return null;
      })}
    </div>
  );

};

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
