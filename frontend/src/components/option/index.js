import React from 'react';
import classnames from 'classnames';

import './index.css';

const Option = ({ option, className, children }) => {
  if (!option) return null;

  const { color, text_color, border_color = 'transparent', name, display_name } = option;
  return (
    <div
      style={{ color: text_color, borderColor: border_color, backgroundColor: color }}
      className={classnames('sea-qa-ui-option', className)}
    >
      <span className="sea-qa-ui-option-name">{display_name || name}</span>
      {children}
    </div>
  );
};

export default Option;
