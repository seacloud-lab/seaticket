import React from 'react';
import { Attachment } from '../../components';

import './index.css';

const AttachmentsFormatter = ({ value = [], onRemove }) => {
  const validValue = Array.isArray(value) ? value.filter(Boolean) : [];

  if (validValue.length === 0) return null;

  return (
    <div className="w-100 px-4 o-hidden">
      <div className="sea-qa-ai-chat-attachments">
        {validValue.map((item, index) => {
          return (<Attachment value={item} index={index} onRemove={onRemove} />);
        })}
      </div>
    </div>
  );
};

export default AttachmentsFormatter;
