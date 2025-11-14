import { useState, useCallback } from 'react';
import classnames from 'classnames';
import { CustomizeMarkdownViewer } from '@/components';

const StepMarkdownViewer = ({ value, className }) => {
  const [aiMessageType, setAIMessageType] = useState('rich-text');

  const beforeAIReplyRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAIMessageType('text');
    }
  }, []);

  return (
    <div className={classnames('sea-qa-message-ai-reply', className, aiMessageType)}>
      <CustomizeMarkdownViewer value={value} showTOC={false} beforeRenderCallback={beforeAIReplyRenderCallback} />
    </div>
  );
};

export default StepMarkdownViewer;
