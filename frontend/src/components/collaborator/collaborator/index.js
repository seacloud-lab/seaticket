import React from 'react';
import classnames from 'classnames';

import './index.css';

const Collaborator = ({ collaborator, className, children }) => {

  if (!collaborator) return null;

  return (
    <div className={classnames('collaborator', className)} title={collaborator.name}>
      <span className="collaborator-avatar">
        <img className="collaborator-avatar-icon" alt={collaborator.name} src={collaborator.avatar_url} />
      </span>
      <span className="collaborator-name" title={collaborator.name} aria-label={collaborator.name}>
        {collaborator.name}
      </span>
      {children}
    </div>
  );
};

export default Collaborator;
