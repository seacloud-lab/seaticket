import React, { useCallback, useState, useMemo } from 'react';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '@/project/main-panel/ask/constants';
import { CustomizeMarkdownViewer as CustomizeMarkdownViewerComponent } from '@/components';

import '@/project/main-panel/ask/chat-history/customize-markdown-viewer/index.css';

const PortalCustomizeMarkdownViewer = ({ message, className }) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');

  const aiReply = useMemo(() => {
    if (Object.keys(message).length === 0) return '';
    return message[CHAT_MESSAGE_TYPE.AI_REPLY] || '';
  }, [message]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    }
  }, []);

  if (!aiReply) return null;

  return (
    <div className={classnames('sea-qa-message-ai-reply', aiMessageType, className)}>
      <CustomizeMarkdownViewerComponent
        value={aiReply}
        showTOC={false}
        beforeRenderCallback={beforeAIReplyRenderCallback}
      />
    </div>
  );
};

export default PortalCustomizeMarkdownViewer;
