import React, { useCallback } from 'react';
import copy from 'copy-to-clipboard';
import { IconButton, toaster } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const MessageOperations = ({ getMessageHTML, getAnswer }) => {

  const onCopy = useCallback(() => {
    const answer = getAnswer();
    const messageHTML = getMessageHTML();

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([messageHTML], { type: 'text/html' }),
        'text/plain': new Blob([answer], { type: 'text/plain' })
      })
    ]).then(() => {
      toaster.success(gettext('The content has been copied'));
    }).catch(err => {
      copy(answer);
    });
  }, [getMessageHTML, getAnswer]);

  return (
    <div className="sea-qa-ai-answer-operations">
      <IconButton icon="copy" onClick={onCopy} />
    </div>
  );
};

export default MessageOperations;
