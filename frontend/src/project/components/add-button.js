import React from 'react';
import { Button } from 'reactstrap';
import { Icon } from '@/components';
import classnames from 'classnames';

import './add-button.css';

const AddButton = ({ onClick, text, icon, className }) => {
  return (
    <Button
      color='primary'
      onClick={onClick}
      className={classnames('sea-qa-project-add-btn', className)}
    >
      {icon && <Icon symbol={icon} className="mr-2" />}
      {text}
    </Button>
  );
};

export default AddButton;
