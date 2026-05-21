import React, { useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import ThoughtProcess from '../thought-process';
import { Attachments } from '../../components';
import AIReply from '@/project/components/ai-reply';
import MessageOperations from '../message-operations';
import { useDocuments } from '../../hooks';
import { AttachmentObject } from '../../models';

import './index.css';

const CommonMessage = ({
  chatId, message, settings, projectUuid, projectName, workspaceID,
  showOperations,
}) => {
  const markdownMessageRef = useRef(null);

  const { openDocument } = useDocuments();

  const attachments = useMemo(() => {
    const _attachments = message[CHAT_MESSAGE_TYPE.ATTACHMENTS];
    if (!Array.isArray(_attachments) || _attachments.length === 0) return [];
    return _attachments.map(attachment => {
      if (attachment instanceof AttachmentObject) return attachment;
      return new AttachmentObject(attachment);
    });
  }, [message]);

  const getAIReply = useCallback(() => {
    return markdownMessageRef.current.getAIReply();
  }, [markdownMessageRef.current]);

  return (
    <>
      <Attachments attachments={attachments} projectUuid={projectUuid} />
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
