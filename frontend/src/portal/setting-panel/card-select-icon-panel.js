import React from 'react';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import SelectProjectIconContent from '@/home/components/select-project-icon-content';

import './card-select-icon-panel.css';

const CardSelectIconPanel = ({ currentIcon, onPrevious, onSubmit }) => {
  return (
    <aside className="portal-card-icon-selection">
      <div className="portal-setting-header portal-card-icon-selection-header">
        <div className="portal-card-icon-selection-header-left">
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
