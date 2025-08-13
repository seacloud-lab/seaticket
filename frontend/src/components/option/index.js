import React from 'react';
import classnames from 'classnames';

import './index.css';

const Option = ({ option, className, children }) => {

  const { color, textColor, borderColor, name } = option;
  return (
    <div
      style={{ color: textColor, borderColor, backgroundColor: color }}
      className={classnames('sea-qa-ui-option', className)}
    >
      <span className="sea-qa-ui-option-name">{name}</span>
      {children}
    </div>
  );
};

export default Option;
