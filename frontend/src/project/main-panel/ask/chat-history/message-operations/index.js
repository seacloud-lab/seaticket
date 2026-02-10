import React, { useCallback } from 'react';
import copy from 'copy-to-clipboard';
import { IconButton, toaster } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const MessageOperations = ({ getAIReply }) => {

  const onCopy = useCallback(() => {
    const AIReply = getAIReply();
    copy(AIReply);
    toaster.success(gettext('The content has been copied'));
  }, [getAIReply]);

  return (
    <div className="sea-qa-ai-answer-operations">
      <IconButton icon="copy" onClick={onCopy} title={gettext('Copy')} aria-label={gettext('Copy')} size={{ icon: 14 }} />
    </div>
  );
};

export default MessageOperations;
