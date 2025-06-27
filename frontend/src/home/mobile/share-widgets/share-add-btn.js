import React from 'react';
import PropTypes from 'prop-types';

export default function ShareAddedBtn(props) {
  const { callback, addedName, className } = props;
  return (
    <div className={`share-add-btn-container ${className || ''}`}>
      <button className="share-add-btn btn" onClick={callback}>{addedName}</button>
    </div>
  );
}

ShareAddedBtn.propTypes = {
  addedName: PropTypes.string,
  className: PropTypes.string,
  callback: PropTypes.func,
};
