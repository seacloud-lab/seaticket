import React from 'react';
import { Attachment } from '../../components';

import './index.css';

const AttachmentsFormatter = ({ value = [], onRemove }) => {

  if (!Array.isArray(value) || value.length === 0) return null;

  return (
    <div className="w-100 px-4 o-hidden">
      <div className="sea-qa-ai-chat-attachments">
        {value.map((item, index) => {
          return (<Attachment attachment={item} index={index} onRemove={onRemove} />);
        })}
      </div>
    </div>
  );
};

export default AttachmentsFormatter;
