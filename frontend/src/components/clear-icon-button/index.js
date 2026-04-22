import React from 'react';
import IconButton from '../icon-button';
import { gettext } from '@/constants';

import './index.css';

const ClearIconButton = ({ ...props }) => {
  return (
    <IconButton
      className='sea-ticket-clear-icon-button no-hover-bg'
      icon="close"
      title={gettext('Clear search')}
      { ...props }
    />
  );

};

export default ClearIconButton;
