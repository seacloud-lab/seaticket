import React from 'react';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import SelectProjectIconContent from '@/home/components/select-project-icon-content';

import './index.css';

const CardSelectIconPanel = ({ currentIcon, onPrevious, onSubmit }) => {
  return (
    <aside className="portal-card-icon-selection d-flex flex-column">
      <div className="portal-setting-header portal-card-icon-selection-header d-flex align-items-center justify-content-between pb-2">
        <div className="portal-card-icon-selection-header-left d-flex align-items-center">
          <IconButton
            icon="arrow-left"
            onClick={onPrevious}
            title={gettext('Back')}
            aria-label={gettext('Back')}
          />
          <div className="portal-setting-title portal-card-icon-selection-title ml-1">{gettext('Select icon')}</div>
        </div>
        <div className="portal-card-icon-selection-header-center" />
        <div className="portal-card-icon-selection-header-right" />
      </div>
      <SelectProjectIconContent
        currentIcon={currentIcon}
        onPrevious={onPrevious}
        onSubmit={onSubmit}
        previousButtonText={gettext('Cancel')}
        isHideFooter={true}
      />
    </aside>
  );
};

export default CardSelectIconPanel;
