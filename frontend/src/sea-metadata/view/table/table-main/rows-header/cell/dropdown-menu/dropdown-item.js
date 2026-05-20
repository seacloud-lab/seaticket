import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Tooltip, CustomizeDropdownItem, CustomizeDropdownItemIcon, CustomizeDropdownItemText } from '@/components';

const ColumnDropdownItem = ({
  disabled = false,
  iconName,
  target,
  title,
  tip,
  className = '',
  onChange = () => {},
  onMouseEnter = () => {},
}) => {
  const [isShowToolTip, setToolTipShow] = useState(false);

  useEffect(() => {
    if (disabled) {
      setToolTipShow(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onClick = useCallback((event) => {
    event.preventDefault();
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  }, []);

  if (!disabled) {
    return (
      <CustomizeDropdownItem id={target} onClick={onChange} onMouseEnter={onMouseEnter} className={className}>
        {iconName && (<CustomizeDropdownItemIcon className="sea-metadata-icon" symbol={iconName} />)}
        <CustomizeDropdownItemText>{title}</CustomizeDropdownItemText>
      </CustomizeDropdownItem>
    );
  }

  return (
    <>
      <CustomizeDropdownItem
        className={classnames('disabled', className)}
        toggle={true}
        disabled={true}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        id={target}
      >
        {iconName && (<CustomizeDropdownItemIcon className="sea-metadata-icon" symbol={iconName} />)}
        <CustomizeDropdownItemText>{title}</CustomizeDropdownItemText>
        {isShowToolTip && (
          <Tooltip placement="right" target={target} delay={{ show: 0, hide: 0 }}>
            {tip}
          </Tooltip>
        )}
      </CustomizeDropdownItem>
    </>
  );

};

ColumnDropdownItem.propTypes = {
  disabled: PropTypes.bool,
  target: PropTypes.string,
  iconName: PropTypes.string,
  title: PropTypes.string,
  tip: PropTypes.string,
  className: PropTypes.string,
  onChange: PropTypes.func,
  onMouseEnter: PropTypes.func,
};

export default ColumnDropdownItem;
