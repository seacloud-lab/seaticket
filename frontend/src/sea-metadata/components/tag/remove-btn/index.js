import React from 'react';
import { IconButton } from '@/components';

import './index.css';

const RemoveBtn = ({ callback }) => {
  return (
    <IconButton icon="x" onClick={callback} className="sea-metadata-tag-remove no-hover-bg" />
  );
};

export default RemoveBtn;
