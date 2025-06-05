import React from 'react';
import PropTypes from 'prop-types';

function CollaboratorOptionItem(props) {
  const { isSelected, collaborator, className } = props;
  if (!collaborator) return null;
  const { name, avatar_url } = collaborator;
  return (
    <div className={`collaborator-container collaborator-option-item d-flex align-items-center ${className || ''}`}>
      <div className="collaborator">
        <span className="collaborator-avatar-container">
          <img className="collaborator-avatar" alt='' src={avatar_url} />
        </span>
        <span className="collaborator-name" title={name} aria-label={name}>
          {name}
        </span>
      </div>
      <div className="collaborator-check-icon">
        {isSelected && (
          <i className="option-edit dtable-font dtable-icon-check-mark"></i>
        )}
      </div>
    </div>
  );
}

CollaboratorOptionItem.propTypes = {
  isSelected: PropTypes.bool,
  className: PropTypes.string,
  collaborator: PropTypes.object,
};

export default CollaboratorOptionItem;
