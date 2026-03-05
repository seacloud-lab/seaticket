import React from 'react';
import IconButton from '../../icon-button';

import './index.css';

const RemoveBtn = ({ callback }) => {
  return (
    <IconButton icon="close" onClick={callback} className="collaborator-remove no-hover-bg" size={{ btn: 14, icon: 10 }} />
  );
};

export default RemoveBtn;
