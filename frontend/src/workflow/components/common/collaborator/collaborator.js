import React from 'react';
import PropTypes from 'prop-types';

function Collaborator(props) {
  const { isShowRemove, collaborator, className } = props;
  if (!collaborator) return null;
  const { email, name, avatar_url } = collaborator;
  return (
    <div key={email} className={`collaborator ${className || ''}`}>
      <span className="collaborator-avatar-container">
        <img className="collaborator-avatar" alt={''} src={avatar_url} />
      </span>
      <span className="collaborator-name text-truncate" title={name} aria-label={name}>
        {name}
      </span>
      {isShowRemove &&
        <span className="remove-container" onClick={(event) => props.onRemove(event, email)}>
          <span className="remove-icon">
            <i className="dtable-font dtable-icon-fork-number collaborator-remove-icon"></i>
          </span>
        </span>
      }
    </div>
  );
}

Collaborator.propTypes = {
  isShowRemove: PropTypes.bool,
  className: PropTypes.string,
  collaborator: PropTypes.object,
  onRemove: PropTypes.func,
};

export default Collaborator;
