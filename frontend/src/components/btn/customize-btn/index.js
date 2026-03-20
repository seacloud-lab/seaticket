import React from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const CustomizeBtn = ({ icon, className, children, ...rest }) => {
  return (
    <Button className={classnames('sea-ticket-customize-btn', className)} { ...rest }>
      {icon && (<Icon symbol={icon} className="sea-ticket-customize-btn-icon mr-2" />)}
      {children}
    </Button>
  );
};

export default CustomizeBtn;
