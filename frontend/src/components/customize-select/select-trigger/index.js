import React from 'react';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const SelectTrigger = ({
  focus,
  disabled,
  className,
  id,
  innerRef,
  selectedValue,
  onClick,
  children,
}) => {
  return (
    <div
      ref={innerRef}
      className={classnames('seaqa-select seaqa-customize-select position-relative', className,
        { 'focus': focus },
        { 'disabled': disabled },
      )}
      id={id}
      onClick={onClick}
    >
      <div className="seaqa-select-container">
        <div className="selected-option">
          {selectedValue}
          {!disabled && (<Icon symbol="arrow-down" />)}
        </div>
      </div>
      {children}
    </div>
  );
};

export default SelectTrigger;
