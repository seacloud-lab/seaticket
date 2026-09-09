import React from 'react';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import SelectProjectIconContent from '@/home/components/select-project-icon-content';

import './card-select-icon-panel.css';

const CardSelectIconPanel = ({ currentIcon, onPrevious, onSubmit }) => {
  return (
    <aside className="portal-home-card-select-icon-container">
      <div className="portal-home-edit-panel-header portal-home-card-select-icon-header">
        <div className="portal-home-card-select-icon-header-left">
          <IconButton
            icon="arrow-left"
            onClick={onPrevious}
            title={gettext('Back')}
            aria-label={gettext('Back')}
          />
          <div className="portal-home-edit-panel-title portal-home-card-select-icon-title ml-1">{gettext('Select icon')}</div>
        </div>
        <div className="portal-home-card-select-icon-header-center" />
        <div className="portal-home-card-select-icon-header-right" />
      </div>
      <SelectProjectIconContent
        currentIcon={currentIcon}
        onPrevious={onPrevious}
        onSubmit={onSubmit}
        previousButtonText={gettext('Cancel')}
      />
    </aside>
  );
};

export default CardSelectIconPanel;
