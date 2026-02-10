import React, { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import ThoughtProcess from '../thought-process';
import { Attachments } from '../../components';
import CustomizeMarkdownViewer from '../customize-markdown-viewer';
import MessageOperations from '../message-operations';

import './index.css';

const CommonMessage = ({
  chatId, message, settings, projectUuid, projectName, workspaceID,
  showOperations,
}) => {
  const markdownMessageRef = useRef(null);

  const getAIReply = useCallback(() => {
    return markdownMessageRef.current.getAIReply();
  }, [markdownMessageRef.current]);

  return (
    <>
      <Attachments attachments={message[CHAT_MESSAGE_TYPE.ATTACHMENTS]} projectUuid={projectUuid} />
      <div className="sea-qa-ai-ask-message-content">
        <ThoughtProcess
          value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]}
          projectUuid={projectUuid}
          settings={settings}
          projectName={projectName}
          workspaceID={workspaceID}
        />
        {message[CHAT_MESSAGE_TYPE.TEXT] && (<>{message[CHAT_MESSAGE_TYPE.TEXT]}</>)}
        <CustomizeMarkdownViewer
          ref={markdownMessageRef}
          chatId={chatId}
          message={message}
          projectName={projectName}
          projectUuid={projectUuid}
          workspaceID={workspaceID}
        />
        {showOperations && (<MessageOperations getAIReply={getAIReply} />)}
      </div>
    </>
  );
};

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
