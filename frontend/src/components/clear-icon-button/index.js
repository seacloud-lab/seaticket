import React from 'react';
import { gettext } from '@/constants';
import IconButton from '../icon-button';

import './index.css';

const ClearIconButton = ({ ...props }) => {
  return (
    <IconButton
      className='seaqa-clear-icon-button'
      icon="close"
      title={gettext('Clear search')}
      { ...props }
    />
  );

};

export default ClearIconButton;
