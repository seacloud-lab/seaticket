import React, { useCallback } from 'react';
import { Button } from 'reactstrap';
import dayjs from '@/utils/dayjs';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '../../../../api';
import BasicTopBar from '../../../top-bar';
import { useConnectionsPage, useConnections } from '../../hooks';
import { CONNECTION_PAGE_SLUG_ID } from '../../constants';
import { IconButton, Icon, toaster } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const TopBar = ({ title }) => {
  const { pageSlugId, pageName, togglePageSlugId } = useConnectionsPage();
  const { modifyLocalConnectionRecord } = useConnections();

  const handleNewConnection = useCallback(() => {
    eventBus.dispatch(EVENT_BUS_TYPE.NEW_CONNECTION);
  }, []);

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
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
          onClick={() => togglePageSlugId(CONNECTION_PAGE_SLUG_ID.ALL)}
        />
        <span className="text-truncate" title={connectionTitle}>{connectionTitle}</span>
      </>
    );
  }, [pageSlugId, title, pageName, togglePageSlugId]);

  const onManualSync = useCallback((connectionID) => {
    connectionsAPI.triggerSync(projectUuid, connectionID).then(() => {
      toaster.success(gettext('Sync task queued'));
      modifyLocalConnectionRecord(connectionID, { status: { last_sync_status: 'pending' } });
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      let error_msg = '';
      if (errorMessage.message_type === 'Manual sync too frequent') {
        const next_time = errorMessage.next_time ? dayjs(errorMessage.next_time).format('YYYY-MM-DD HH:mm:ss') : '--';
        error_msg = errorMessage.message_type + '. Next time:' + next_time;
      } else {
        error_msg = errorMessage;
      }
      toaster.danger(error_msg);
    });
  }, [modifyLocalConnectionRecord]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
      return (
        <Button color="primary" className="sea-qa-project-add-connection-btn" onClick={handleNewConnection}>
          <Icon symbol="add" className="mr-2" />
          {gettext('New connection')}
        </Button>
      );
    } else {
      return (
        <Button color="primary" className="sea-qa-project-add-connection-btn" onClick={() => { onManualSync(pageSlugId);}}>
          <Icon symbol="sync" className="mr-2" />
          {gettext('Sync now')}
        </Button>
      );
    }
  }, [pageSlugId, handleNewConnection]);

  return (
    <BasicTopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </BasicTopBar>
  );
};

export default TopBar;
