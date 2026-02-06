import React from 'react';
import Icon from '@/components/icon';
import { gettext } from '@/constants';

import './resolved-tag.css';

const ResolvedTag = () => {
  return (
    <div className="resolved-tag-container">
      <div className="resolved-tag-icon-bg">
        <Icon symbol="check-mark" className="resolved-tag-icon" />
      </div>
      <span className="resolved-tag-text">{gettext('Resolved')}</span>
    </div>
  );
};

export default ResolvedTag;
