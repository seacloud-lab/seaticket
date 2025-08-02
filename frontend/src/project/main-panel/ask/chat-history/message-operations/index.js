import React, { useCallback } from 'react';
import copy from 'copy-to-clipboard';
import { IconButton, toaster } from '../../../../../components';
import { CHAT_MESSAGE_TYPE } from '../../../../constants';
import { gettext } from '../../../../../constants';

import './index.css';

const MessageOperations = ({ messages, getMessageHTML }) => {

  const onCopy = useCallback(() => {
    let context = [];
    messages.forEach(message => {
      const messageType = Object.prototype.toString.call(message).slice(8, -1);
      if (messageType === 'String') {
        context.push(message);
      } else {
        const { type, value } = message;
        if (type === CHAT_MESSAGE_TYPE.SOURCES) {
          if (value.length > 0) {
            let valueString = `## ${gettext('Sources')}`;
            value.forEach((link, index) => {
              valueString = `${valueString}\n[${index + 1}] [${link.title}](${link.url} "${link.title}")`;
            });
            context.push(valueString);
          }
        } else {
          context.push(value);
        }
      }
    });
    context = context.join('\n\n');
    const messageHTML = getMessageHTML();

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([messageHTML], { type: 'text/html' }),
        'text/plain': new Blob([context], { type: 'text/plain' })
      })
    ]).then(() => {
      toaster.success(gettext('The content has been copied'));
    }).catch(err => {
      copy(context);
    });
  }, [messages, getMessageHTML]);

  return (
    <div className="sea-qa-ai-answer-operations">
      <IconButton icon="copy" onClick={onCopy} />
    </div>
  );
};

export default MessageOperations;
