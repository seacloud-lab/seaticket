import React, { Fragment, useCallback, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { CustomizeMarkdownViewer } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const CommonMessage = forwardRef(({ messages }, ref) => {
  const contentRef = useRef(null);

  const [answerType, setAnswerType] = useState('rich-text');

  const beforeAnswerRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAnswerType('text');
    }
  }, []);

  useImperativeHandle(ref, () => ({

    getHTML: () => {
      if (!Array.isArray(messages) || messages.length === 0) return '';
      return contentRef.current.innerHTML;
    },

  }), [messages, contentRef]);

  if (!Array.isArray(messages) || messages.length === 0) return null;
  return (
    <div className="sea-qa-ai-ask-message-content" ref={contentRef}>
      {messages.map((message, messageIndex) => {
        const messageType = Object.prototype.toString.call(message).slice(8, -1);
        if (messageType === 'String') return (<Fragment key={`sea-qa-ai-ask-message-${messageIndex}`}>{message}</Fragment>);
        if (messageType === 'Object') {
          const { type, value } = message;
          if (type === CHAT_MESSAGE_TYPE.TEXT) return (<Fragment key={`sea-qa-ai-ask-message-${messageIndex}`}>{value}</Fragment>);
          if (type === CHAT_MESSAGE_TYPE.MEMORY && value.length > 0) {
            return (
              <div className="sea-qa-ai-ask-message-sources" key={`sea-qa-ai-ask-message-${messageIndex}`}>
                <h2 className="sea-qa-ai-ask-message-sources-title">{gettext('run')}</h2>
                <div className="sea-qa-ai-ask-message-sources-container w-100">
                  {value.map((v, index) => {
                    if (!v.tool_calls) {
                      return null;
                    }
                    return (
                      <div key={index} title={v.title}>
                        <p className="">{`Step:[${index}]`}</p>
                        <p>{gettext('Calling_tool:')}</p>
                        <p>{v.tool_calls[0].function.name}</p>
                        <p>with arguments: {JSON.stringify(v.tool_calls[0].function.arguments)}</p>
                        <p>{gettext('Model input messages:')}{JSON.stringify(v.model_input_messages)}</p>
                        <p>{gettext('Observations: Retrieved documents:')}</p>
                        <p><CustomizeMarkdownViewer value={v.observations} showTOC={false} beforeRenderCallback={beforeAnswerRenderCallback} /></p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
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
                      <p className="sea-qa-ai-ask-message-source" key={index} title={v.title}>
                        <span className="">{`[${index + 1}]`}&ensp;</span>
                        <a href={v.url} rel="noreferrer" target="_blank">{v.title}</a>
                      </p>
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

});

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
