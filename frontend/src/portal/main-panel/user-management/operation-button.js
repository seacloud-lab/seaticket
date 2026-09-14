import React from 'react';
import { IconTooltip } from '@/components';

const OperationButton = ({ icon, tip, onClick }) => (
  <IconTooltip
    className="bg-color-deep"
    icon={icon}
    placement="bottom"
    tip={tip}
    hoverBackground
    onClick={onClick}
  />
);

export default OperationButton;
