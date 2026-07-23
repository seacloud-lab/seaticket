import React from 'react';
import { gettext } from '@/constants';

import './index.css';

const NormalDetail = ({ isEdit, value, onChange }) => {
  if (isEdit) return (
    <textarea
      className="suggestion-detail-panel-textarea"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={gettext('Edit content...')}
      spellCheck={false}
      autoFocus
    />
  );
  return <div className="suggestion-detail-panel-content">{value}</div>;
};

export default NormalDetail;
