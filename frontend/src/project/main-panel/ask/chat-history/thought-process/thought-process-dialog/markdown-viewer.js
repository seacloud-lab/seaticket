import { useState, useCallback } from 'react';
import classnames from 'classnames';
import { CustomizeMarkdownViewer } from '@/components';

const StepMarkdownViewer = ({ value, className }) => {
  const [answerType, setAnswerType] = useState('rich-text');

  const beforeAnswerRenderCallback = useCallback((value) => {
    if (value.length === 1 && value[0].type === 'paragraph') {
      setAnswerType('text');
    }
  }, []);

  return (
    <div className={classnames('sea-qa-ai-ask-message-answer', className, answerType)}>
      <CustomizeMarkdownViewer value={value} showTOC={false} beforeRenderCallback={beforeAnswerRenderCallback} />
    </div>
  );
};

export default StepMarkdownViewer;
