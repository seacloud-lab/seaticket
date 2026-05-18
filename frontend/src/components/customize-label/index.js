import React from 'react';
import { Label } from 'reactstrap';
import Icon from '../icon';

import './index.css';

const CustomizeLabel = ({ icon, children }) => {
  return (
    <Label className="seaqa-customize-label">
      {icon && (<Icon symbol={icon} className="seaqa-customize-label-icon mr-2" />)}
      <span className="seaqa-customize-label-content">{children}</span>
    </Label>
  );
};

export default CustomizeLabel;
