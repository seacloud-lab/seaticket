import React from 'react';
import classnames from 'classnames';
import { IconTooltip } from '@/components';
import { gettext } from '@/constants';

import './index.css';

const RefreshBtn = ({ onClick, className }) => {
  return (
    <IconTooltip
      icon="refresh"
      tip={gettext('Refresh')}
      className={classnames('sea-ticket-project-refresh-btn', className)}
      placement="bottom"
      hoverBackground={true}
      onClick={onClick}
    />
  );
};

export default RefreshBtn;
