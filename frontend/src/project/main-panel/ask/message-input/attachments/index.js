import React from 'react';
import { Attachments } from '../../components';

import './index.css';

const AttachmentsFormatter = ({ projectUuid, value = [], onRemove }) => {
  const validValue = Array.isArray(value) ? value.filter(Boolean) : [];

  if (validValue.length === 0) return null;

  return (
    <div className="w-100 px-4 o-hidden">
      <Attachments className="sea-qa-ai-chat-attachments" attachments={validValue} projectUuid={projectUuid} onRemove={onRemove} />
    </div>
  );
};

export default AttachmentsFormatter;
