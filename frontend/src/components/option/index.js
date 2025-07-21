import React from 'react';
import classnames from 'classnames';

import './index.css';

const Option = ({ option, className, children }) => {

  const { color, bgColor, borderColor, name } = option;
  return (
    <div
      style={{ color, borderColor, backgroundColor: bgColor }}
      className={classnames('option', className)}
    >
      <span className="option-name">{name}</span>
      {children}
    </div>
  );
};

export default Option;
