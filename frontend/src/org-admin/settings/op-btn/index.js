import React from 'react';
import { Button } from 'reactstrap';
import classnames from 'classnames';

import './index.css';

const OpBtn = ({ children, className, ...props }) => {
  return (
    <Button className={classnames('org-admin-op-btn', className)} { ...props}>
      {children}
    </Button>
  );
};

export default OpBtn;
