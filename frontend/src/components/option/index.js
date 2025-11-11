import React from 'react';
import classnames from 'classnames';

import './index.css';

const Option = ({ option, className, children }) => {

  const { color, text_color, border_color = 'transparent', name } = option;
  return (
    <div
      style={{ color: text_color, borderColor: border_color, backgroundColor: color }}
      className={classnames('sea-qa-ui-option', className)}
    >
      <span className="sea-qa-ui-option-name">{name}</span>
      {children}
    </div>
  );
};

export default Option;
