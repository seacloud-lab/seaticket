import React from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../../icon';

import './index.css';

const CustomizeBtn = ({ icon, className, children, ...rest }) => {
  return (
    <Button className={classnames('seaqa-customize-btn', className)} { ...rest }>
      {icon && (<Icon symbol={icon} className="seaqa-customize-btn-icon mr-2" aria-hidden="true" />)}
      {children}
    </Button>
  );
};

export default CustomizeBtn;
