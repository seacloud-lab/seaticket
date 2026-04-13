import React from 'react';
import classnames from 'classnames';
import { isWhiteColor } from '@/utils/color-utils';

import './index.css';

const Option = ({ option, className, children }) => {
  if (!option) return null;

  const { color, text_color, border_color = 'transparent', name, display_name } = option;
  let style = { color: text_color || option.textColor, borderColor: border_color, backgroundColor: color };

  if (isWhiteColor(option.color)) {
    style['border'] = '1px solid #d1d9e0b3';
    style['lineHeight'] = '18px';
  }

  return (
    <div
      style={style}
      className={classnames('sea-qa-ui-option', className)}
    >
      <span className="sea-qa-ui-option-name">{display_name || name}</span>
      {children}
    </div>
  );
};

export default Option;
