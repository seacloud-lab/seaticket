import React, { useMemo } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { isWhiteColor } from '@/utils/color-utils';
import { getOptionDisplayNameByOption } from '../../../utils/column';

import './index.css';

const SelectOption = ({ option, className, fontSize, children }) => {
  const style = useMemo(() => {
    let _style = {
      padding: '0px 10px',
      height: '20px',
      lineHeight: '20px',
      textAlign: 'center',
      borderRadius: '10px',
      maxWidth: 'min(calc(100%), 250px)',
      fontSize: fontSize ? fontSize : 13,
      backgroundColor: option.color,
      color: option.text_color || option.textColor || null,
    };
    if (isWhiteColor(option.color)) {
      _style['border'] = '1px solid #d1d9e0b3';
      _style['lineHeight'] = '18px';
    }
    if (children) {
      _style['gap'] = 4;
    }
    return _style;
  }, [option, fontSize, children]);

  const optionName = getOptionDisplayNameByOption(option);

  return (
    <div
      className={classnames('sea-metadata-ui-select-option d-flex align-items-center justify-content-center', className)}
      style={style}
      title={optionName}
      aria-label={optionName}
    >
      <span className="flex-1 text-truncate">{optionName}</span>
      {children}
    </div>
  );
};

SelectOption.propTypes = {
  option: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
  }),
  fontSize: PropTypes.number,
  children: PropTypes.node,
};

export default SelectOption;
