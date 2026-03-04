import React from 'react';
import IconButton from '../icon-button';

const PriorityIconBtn = ({ priority }) => {
  if (!priority) return null;
  return (
    <IconButton className="sea-ticket-priority-icon-btn no-hover-bg" icon={priority.icon} size={16} title={priority.name} />
  );
};

export default PriorityIconBtn;
