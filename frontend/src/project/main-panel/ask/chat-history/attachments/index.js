import React from 'react';
import { Attachment } from '../../components';

import './index.css';

const Attachments = ({ value }) => {
  if (!Array.isArray(value) || value.length < 0) return null;
  return (
    <div className="sea-qa-ai-chat-message-attachments">
      {value.map((attachment, index) => {
        return (<Attachment attachment={attachment} index={index} key={index} />);
      })}
    </div>
  );
};

export default Attachments;
