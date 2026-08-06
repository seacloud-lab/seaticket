import React, { useCallback, useEffect, useState } from 'react';
import { gettext } from '@/constants';

import './index.css';

const NormalDetail = ({ isEdit, value, onChange }) => {
  const [detail, setDetail] = useState('');

  const handleChange = useCallback((newDetail) => {
    setDetail(newDetail);
    onChange && onChange(newDetail);
  }, [onChange]);

  useEffect(() => {
    setDetail(value);
  }, [value]);

  if (isEdit) {
    return (
      <textarea
        className="seaqa-agent-tool-suggestion-panel-textarea"
        value={detail}
        onChange={e => handleChange(e.target.value)}
        placeholder={gettext('Edit content...')}
        spellCheck={false}
        autoFocus
      />
    );
  }
  return <div className="seaqa-agent-tool-suggestion-panel-content">{value}</div>;
};

export default NormalDetail;
