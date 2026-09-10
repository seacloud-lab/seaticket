import React from 'react';
import PropTypes from 'prop-types';

import './empty-project-card.css';

const gettext = window.gettext;

const EmptyProjectCard = ({ onClick, width }) => (
  <div className="empty-project-card" onClick={onClick} style={{ width }}>
    <div className="empty-project-card-icon">+</div>
    <p className="empty-project-card-text">{gettext('Add a project to track issues')}</p>
  </div>
);

EmptyProjectCard.propTypes = {
  onClick: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};

export default EmptyProjectCard;
