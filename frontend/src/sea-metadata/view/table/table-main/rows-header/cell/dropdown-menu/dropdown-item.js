import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip, DropdownItem } from 'reactstrap';
import classnames from 'classnames';
import Icon from '@/components/icon';

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
      <DropdownItem id={target} onClick={onChange} onMouseEnter={onMouseEnter} className={className}>
        <Icon className="sea-metadata-icon" symbol={iconName} />
        <span className="item-text">{title}</span>
      </DropdownItem>
    );
  }

  return (
    <>
      <DropdownItem
        className={classnames('disabled', className)}
        toggle={true}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        id={target}
      >
        {iconName && <Icon className="sea-metadata-icon" symbol={iconName} />}
        <span className="item-text">{title}</span>
        {isShowToolTip && (
          <UncontrolledTooltip placement="right" target={target} fade={false} delay={{ show: 0, hide: 0 }} className="sea-metadata-tooltip">
            {tip}
          </UncontrolledTooltip>
        )}
      </DropdownItem>
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
