import React, { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import ThoughtProcess from '../thought-process';
import { Attachments } from '../../components';
import AIReply from '@/project/components/ai-reply';
import MessageOperations from '../message-operations';
import { useDocuments } from '../../hooks';

import './index.css';

const CommonMessage = ({
  chatId, message, settings, projectUuid, projectName, workspaceID,
  showOperations,
}) => {
  const markdownMessageRef = useRef(null);

  const { openDocument } = useDocuments();

  const getAIReply = useCallback(() => {
    return markdownMessageRef.current.getAIReply();
  }, [markdownMessageRef.current]);

  return (
    <>
      <Attachments attachments={message[CHAT_MESSAGE_TYPE.ATTACHMENTS]} projectUuid={projectUuid} />
      <div className="seaqa-ai-ask-message-content">
        <ThoughtProcess
          value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]}
          projectUuid={projectUuid}
          settings={settings}
          projectName={projectName}
          workspaceID={workspaceID}
        />
        {message[CHAT_MESSAGE_TYPE.TEXT] && (<>{message[CHAT_MESSAGE_TYPE.TEXT]}</>)}
        <AIReply
          ref={markdownMessageRef}
          messageId={chatId}
          message={message}
          projectName={projectName}
          projectUuid={projectUuid}
          workspaceID={workspaceID}
          openDocument={openDocument}
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
