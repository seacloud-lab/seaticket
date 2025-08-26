import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import BasicTopBar from '../../../top-bar';
import { useConnectionsPage } from '../../hooks';
import { CONNECTION_PAGE_TYPE } from '../../constants';
import { IconButton, Icon } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

import './index.css';

const TopBar = ({ title }) => {
  const { pageType, pageName, togglePageType } = useConnectionsPage();

  const handleNewConnection = useCallback(() => {
    eventBus.dispatch(EVENT_BUS_TYPE.NEW_CONNECTION);
  }, []);

  const renderLeftChildren = useCallback(() => {
    if (pageType === CONNECTION_PAGE_TYPE.ALL) {
      return (
        <div className="w-100 text-truncate">{title}</div>
      );
    }
    const connectionTitle = gettext('Connections') + ' / ' + pageName;
    return (
      <>
        <IconButton
          icon="down"
          className="rotate-icon-90 sea-qa-project-toggle-connections-btn"
          onClick={() => togglePageType(CONNECTION_PAGE_TYPE.ALL)}
        />
        <span className="text-truncate" title={connectionTitle}>{connectionTitle}</span>
      </>
    );
  }, [pageType, title, pageName, togglePageType]);

  const renderRightChildren = useCallback(() => {
    if (pageType === CONNECTION_PAGE_TYPE.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-connection-btn" onClick={handleNewConnection}>
          <Icon symbol="add" className="mr-2" />
          {gettext('Add connection')}
        </Button>
      );
    }
    return null;
  }, [pageType, handleNewConnection]);

  return (
    <BasicTopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </BasicTopBar>
  );
};

export default TopBar;
