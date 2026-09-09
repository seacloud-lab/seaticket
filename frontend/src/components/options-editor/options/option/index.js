import React, { useMemo } from 'react';
import classnames from 'classnames';
import IconButton from '@/components/icon-button';
import { isString } from '@/utils/type-detection';
import OptionLabel from '../../../option';

import './index.css';

const Option = ({
  className,
  checkPlacement,
  highlight,
  isSelected,
  option,
  height,
  index,
  onChange,
  onMouseEnter,
  onMouseLeave,
}) => {
  const validCheckPlacement = useMemo(() => checkPlacement === 'left' ? 'left' : 'right', [checkPlacement]);
  const { icon, img, label, value, disabled } = option;

  return (
    <div
      className={classnames('options-editor-option', className, {
        'active': highlight,
        'disabled': disabled,
        [`check-placement-${validCheckPlacement}`]: validCheckPlacement
      })}
      key={value}
      style={{ minHeight: height }}
      onClick={() => {
        if (disabled) return;
        onChange(value);
      }}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseLeave={() => onMouseLeave(index)}
    >
      {validCheckPlacement === 'right' ? (
        <>
          <div className="options-editor-option-content">
            {option.icon && (<IconButton icon={icon} className="no-hover-bg options-editor-option-icon mr-2 ml-0" />)}
            {option.img && (<img src={img} alt="" className="options-editor-option-icon mr-2 ml-0" />)}
            {option.label ? (
              <>
                {isString(label) ? (<span className="text-truncate" title={label}>{label}</span>) : (<>{label}</>)}
              </>
            ) : (
              <OptionLabel option={option} />
            )}
          </div>
          <IconButton icon={isSelected ? 'check-mark-option' : ''} className="options-editor-option-check-btn no-hover-bg" />
        </>
      ) : (
        <>
          <IconButton icon={isSelected ? 'check-mark-option' : ''} className="options-editor-option-check-btn no-hover-bg mr-2" />
          <div className="options-editor-option-content">
            {icon && (<IconButton icon={icon} className="no-hover-bg options-editor-option-icon mr-2 ml-0" />)}
            {img && (<img src={img} alt="" className="options-editor-option-icon mr-2 ml-0"/>)}
            {option.label ? (
              <>
                {isString(label) ? (<span className="text-truncate" title={label}>{label}</span>) : (<>{label}</>)}
              </>
            ) : (
              <OptionLabel option={option} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Option;
