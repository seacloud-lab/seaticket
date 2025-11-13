import React from 'react';
import classnames from 'classnames';

import './index.css';

const Substate = ({ substate, className }) => {
  if (!substate) return null;
  const { name, color, text_color } = substate;
  return (
    <div
      className={classnames('sea-qa-substate', className)}
      style={{ backgroundColor: color, color: text_color }}
      title={name}
    >
      {name}
    </div>
  );
};

export default Substate;
