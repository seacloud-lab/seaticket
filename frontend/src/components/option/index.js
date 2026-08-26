import React from 'react';
import classnames from 'classnames';
import { isWhiteColor } from '@/utils/color-utils';

import './index.css';

const Option = ({ option, className, fontSize, children }) => {
  if (!option) return null;

  const { color, text_color, border_color = 'transparent', name, display_name } = option;
  let style = { color: text_color || option.textColor, borderColor: border_color || color, backgroundColor: color };

  if (isWhiteColor(option.color)) {
    style['borderColor'] = '#d1d9e0b3';
    style['lineHeight'] = '18px';
  }

  const validName = display_name || name;

  return (
    <div style={style} className={classnames('seaqa-ui-option', className)} title={validName}>
      <span className="flex-1 text-truncate" style={{ fontSize: fontSize || 13 }}>
        {validName}
      </span>
      {children}
    </div>
  );
};

export default Option;
