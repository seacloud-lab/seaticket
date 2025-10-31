import React, { useCallback } from 'react';
import copy from 'copy-to-clipboard';
import { IconButton, toaster } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const MessageOperations = ({ getMessageHTML, getAIReply }) => {

  const onCopy = useCallback(() => {
    const AIReply = getAIReply();
    const messageHTML = getMessageHTML();

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([messageHTML], { type: 'text/html' }),
        'text/plain': new Blob([AIReply], { type: 'text/plain' })
      })
    ]).then(() => {
      toaster.success(gettext('The content has been copied'));
    }).catch(err => {
      copy(AIReply);
    });
  }, [getMessageHTML, getAIReply]);

  return (
    <div className="sea-qa-ai-answer-operations">
      <IconButton icon="copy" onClick={onCopy} />
    </div>
  );
};

export default MessageOperations;
