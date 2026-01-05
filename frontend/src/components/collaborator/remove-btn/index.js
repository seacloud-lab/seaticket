import React from 'react';
import IconButton from '../../icon-button';

import './index.css';

const RemoveBtn = ({ callback }) => {
  return (
    <IconButton icon="close" onClick={callback} className="collaborator-remove no-hover-bg" />
  );
};

export default RemoveBtn;
