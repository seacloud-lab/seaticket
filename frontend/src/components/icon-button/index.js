import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../icon';

import './index.css';

const IconButton = React.forwardRef(({ disabled, className, icon, iconClassName, ...otherProperties }, ref) => {
  return (
    <div
      className={classnames('sea-qa-icon-btn', className, { 'disabled': disabled })}
      {...otherProperties}
      ref={ref}
    >
      {icon && (<Icon symbol={icon} className={iconClassName} />)}
    </div>
  );
});

IconButton.propTypes = {
  disabled: PropTypes.bool,
  classnames: PropTypes.string,
  symbol: PropTypes.string,
};

export default IconButton;
