import React, { useCallback, useState, useImperativeHandle, forwardRef, useMemo, useRef } from 'react';
import classnames from 'classnames';
import { CHAT_MESSAGE_TYPE } from '../../constants';
import AIReferenceMarkdown from '@/project/components/ai-reference-markdown';

import './index.css';

const CustomizeMarkdownViewer = forwardRef(({ chatId, message, projectUuid, projectName, workspaceID, className: propsClassName, canPreviewLinkedFile = true }, ref) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');
  const [className, setClassName] = useState('');
  const markdownRef = useRef(null);

  const { aiReply, sources } = useMemo(() => {
    if (!message || Object.keys(message).length === 0) {
      return { aiReply: '', sources: [] };
    }
    return {
      aiReply: message[CHAT_MESSAGE_TYPE.AI_REPLY] || '',
      sources: Array.isArray(message[CHAT_MESSAGE_TYPE.SOURCES]) ? message[CHAT_MESSAGE_TYPE.SOURCES] : [],
    };
  }, [message]);

  const beforeAIReplyRenderCallback = useCallback((value) => {
    const valueCount = value.length;
    if (valueCount === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    } else {
      setAIMessageType('rich-text');
    }
    setClassName('');
    const lastDom = value[valueCount - 1];
    if (lastDom.type === 'paragraph' && lastDom.children.length > 2) {
      const last2Child = lastDom.children[lastDom.children.length - 2];
      if (last2Child.type === 'link' && last2Child.url.startsWith('file:///sea-ticket/')) {
        setClassName('ends-with-link');
      }
    }
  }, []);

  useImperativeHandle(ref, () => ({
    getAIReply: () => markdownRef.current?.getAIReply?.() || aiReply,
  }), [aiReply]);

  return (
    <>
      {aiReply && (
        <div className={classnames('sea-qa-message-ai-reply', aiMessageType, className, propsClassName)}>
          <AIReferenceMarkdown
            ref={markdownRef}
            value={aiReply}
            sources={sources}
            projectUuid={projectUuid}
            projectName={projectName}
            workspaceID={workspaceID}
            showTOC={false}
            isShowLoading={chatId?.startsWith('typing') && chatId === 'typing' ? false : true}
            canPreviewLinkedFile={canPreviewLinkedFile}
            beforeRenderCallback={beforeAIReplyRenderCallback}
            hideRawReferenceMarkers={chatId === 'typing'}
          />
        </div>
      )}
    </>
  );

});

export default CustomizeMarkdownViewer;
