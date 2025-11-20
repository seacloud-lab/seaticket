import React, { useCallback } from 'react';
import { IconButton, Icon } from '@/components';
import './index.css';
import { gettext } from '@/constants';

const Issue = ({ value, onChange }) => {

  const removeIssue = useCallback((event) => {
    event.stopPropagation();
    onChange(null);
  }, [onChange]);

  if (!value) return null;
  const { icon, title } = value;

  return (
    <div className="sea-qa-ai-issue-reference-container">
      <div className="sea-qa-ai-issue-reference">
        <Icon symbol={icon} className={`sea-qa-project-ticket-status-${icon}-icon mr-2`} />
        <span className="text-truncate flex-1" title={title} aria-label={title}>{title}</span>
        <IconButton
          icon="x"
          className="sea-qa-ai-issue-reference-close"
          onClick={removeIssue}
          title={gettext('Remove')}
        />
      </div>
    </div>
  );
};

export default Issue;
