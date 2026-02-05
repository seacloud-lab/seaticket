import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../icon';
import { isNumber, isObject } from '@/utils/type-detection';

const IconButton = React.forwardRef(({
  disabled,
  className,
  size,
  style,
  icon,
  iconClassName,
  ...otherProperties
}, ref) => {
  const btnStyle = useMemo(() => {
    if (size && isNumber(size)) return { ...style, height: size, width: size };
    if (size && isObject(size) && size.btn) return { ...style, height: size.btn, width: size.btn };
    return style;
  }, [style, size]);

  const iconStyle = useMemo(() => {
    if (icon === 'arrow-down-b' || icon === 'arrow-down') return {};
    if (size && isNumber(size)) return { ...style, height: size, width: size };
    if (size && isObject(size) && size.icon) return { ...style, height: size.icon, width: size.icon };
    return {};
  }, [size, icon]);

  return (
    <div
      className={classnames('sea-qa-icon-btn', className, { 'disabled': disabled })}
      {...otherProperties}
      style={btnStyle}
      ref={ref}
    >
      {icon && (<Icon symbol={icon} className={iconClassName} style={iconStyle} />)}
    </div>
  );
});

IconButton.propTypes = {
  disabled: PropTypes.bool,
  classnames: PropTypes.string,
  symbol: PropTypes.string,
};

export default IconButton;
