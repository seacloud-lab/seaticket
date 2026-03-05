import React, { useMemo } from 'react';
import classnames from 'classnames';
import IconButton from '@/components/icon-button';
import OptionLabel from '../../../option';
import { isString } from '@/utils/type-detection';

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
  const { icon, img, label, value } = option;

  return (
    <div
      className={classnames('option-editor-option', className, {
        'active': highlight,
        [`check-placement-${validCheckPlacement}`]: validCheckPlacement
      })}
      key={value}
      style={{ minHeight: height }}
      onClick={() => onChange(value)}
      onMouseEnter={() => onMouseEnter(index)}
      onMouseLeave={() => onMouseLeave(index)}
    >
      {validCheckPlacement === 'right' ? (
        <>
          <div className="option-editor-option-content">
            {option.icon && (<IconButton icon={icon} className="no-hover-bg option-editor-option-icon mr-2 ml-0" />)}
            {option.img && (<img src={img} alt="" className="option-editor-option-icon mr-2 ml-0" />)}
            {option.label ? (
              <>
                {isString(label) ? (<span className="text-truncate" title={label}>{label}</span>) : (<>{label}</>)}
              </>
            ) : (
              <OptionLabel option={option} />
            )}
          </div>
          <IconButton icon={isSelected ? 'check-mark-option' : ''} className="option-editor-option-check-btn no-hover-bg ml-3" />
        </>
      ) : (
        <>
          <IconButton icon={isSelected ? 'check-mark-option' : ''} className="option-editor-option-check-btn no-hover-bg mr-2" />
          <div className="option-editor-option-content">
            {icon && (<IconButton icon={icon} className="no-hover-bg option-editor-option-icon mr-2 ml-0" />)}
            {img && (<img src={img} alt="" className="option-editor-option-icon mr-2 ml-0"/>)}
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
