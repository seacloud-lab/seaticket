import React, { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { IconTextBtn } from '@/components';
import { gettext } from '@/constants';
import AIReply from '@/project/components/ai-reply';
import { Attachments } from '../../components';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import { useDocuments } from '../../hooks';
import MessageOperations from '../message-operations';
import SuggestionMessage from '../suggestion-message';
import ThoughtProcess from '../thought-process';

import './index.css';

const CommonMessage = ({
  chatId, message, settings, projectUuid, projectName, workspaceID, isApplied,
  showOperations,
}) => {
  const markdownMessageRef = useRef(null);

  const { openDocument } = useDocuments();

  const getAIReply = useCallback(() => {
    return markdownMessageRef.current.getAIReply();
  }, []);

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
        {message[CHAT_MESSAGE_TYPE.TEXT] && (
          <div className="seaqa-ai-ask-message-text">{message[CHAT_MESSAGE_TYPE.TEXT]}</div>
        )}
        {message[CHAT_MESSAGE_TYPE.SUGGESTIONS] && (<SuggestionMessage suggestions={message[CHAT_MESSAGE_TYPE.SUGGESTIONS]} />)}
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
      {isApplied && (
        <IconTextBtn
          className="seaqa-ai-ask-replied text-success"
          icon="check-circle-stroked"
          disabled={true}
          text={gettext('Version applied')}
        />
      )}
    </>
  );
};

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
