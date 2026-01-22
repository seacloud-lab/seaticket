import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import ThoughtProcess from '../thought-process';
import { Attachments } from '../../components';
import CustomizeMarkdownViewer from '../customize-markdown-viewer';

import './index.css';

const CommonMessage = forwardRef(({ chatId, message, settings, projectUuid, projectName, workspaceID }, ref) => {
  const markdownMessageRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getAIReply: () => markdownMessageRef.current.getAIReply(),
  }), [markdownMessageRef]);

  return (
    <>
      <Attachments attachments={message[CHAT_MESSAGE_TYPE.ATTACHMENTS]} projectUuid={projectUuid} />
      <div className="sea-qa-ai-ask-message-content">
        <ThoughtProcess value={message[CHAT_MESSAGE_TYPE.THOUGHT_PROCESS]} settings={settings} />
        {message[CHAT_MESSAGE_TYPE.TEXT] && (<>{message[CHAT_MESSAGE_TYPE.TEXT]}</>)}
        <CustomizeMarkdownViewer
          ref={markdownMessageRef}
          chatId={chatId}
          message={message}
          settings={settings}
          projectName={projectName}
          workspaceID={workspaceID}
        />
      </div>
    </>
  );

});

CommonMessage.propTypes = {
  messages: PropTypes.array,
};

export default CommonMessage;
