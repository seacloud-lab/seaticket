import React from 'react';
import { Button } from 'reactstrap';
import { Icon } from '@/components';

import './add-button.css';

const AddButton = ({ onClick, text, icon }) => {
  return (
    <Button
      color='primary'
      onClick={onClick}
      className='sea-qa-project-add-btn'
    >
      {icon && <Icon symbol={icon} className="mr-2" />}
      {text}
    </Button>
  );
};

export default AddButton;
