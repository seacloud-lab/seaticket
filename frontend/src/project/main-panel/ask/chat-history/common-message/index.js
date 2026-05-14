import React, { useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import ThoughtProcess from '../thought-process';
import { Attachments } from '../../components';
import AIReply from '@/project/components/ai-reply';
import MessageOperations from '../message-operations';
import MessageImages from './message-images';
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

  const { imageAttachments, otherAttachments } = useMemo(() => {
    const all = message[CHAT_MESSAGE_TYPE.ATTACHMENTS];
    if (!Array.isArray(all)) return { imageAttachments: [], otherAttachments: [] };
    const images = [];
    const others = [];
    for (const a of all) {
      if (a && a.type === 'image' && a.path) images.push(a);
      else others.push(a);
    }
    return { imageAttachments: images, otherAttachments: others };
  }, [message]);

  return (
    <>
      <MessageImages images={imageAttachments} />
      <Attachments attachments={otherAttachments} projectUuid={projectUuid} />
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
