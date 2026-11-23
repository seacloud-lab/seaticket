import React from 'react';
import classnames from 'classnames';
import UserAvatar from '@/components/user-avatar';

import './index.css';

const Collaborator = ({ collaborator, className, children }) => {

  if (!collaborator) return null;

  return (
    <div className={classnames('collaborator', className)} title={collaborator.fullName || collaborator.name}>
      <span className="collaborator-avatar">
        <UserAvatar user={{ ...collaborator, fullName: '' }} />
      </span>
      <span className="collaborator-name">
        {collaborator.name}
      </span>
      {children}
    </div>
  );
};

export default Collaborator;
