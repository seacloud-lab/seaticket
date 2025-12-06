import React, { useCallback } from 'react';
import dayjs from '@/utils/dayjs';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '../../../../api';
import BasicTopBar from '../../../top-bar';
import { useConnectionsPage, useConnections } from '../../hooks';
import { CONNECTION_PAGE_SLUG_ID, CONNECTION_TYPE } from '../../constants';
import { IconButton, toaster } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';
import AddButton from '@/project/components/add-button';
import { BAR_TYPE } from '../../../../constants';

import './index.css';

const { projectUuid } = window.app.pageOptions;

const TopBar = ({ title, modifyLocalBar }) => {
  const { pageSlugId, connectionInfo, togglePageSlugId } = useConnectionsPage();
  const { modifyLocalConnectionRecord } = useConnections();
  const { name: connectionName, type: connectionType } = connectionInfo || {};

  const handleNewConnection = useCallback(() => {
    eventBus.dispatch(EVENT_BUS_TYPE.NEW_CONNECTION);
  }, []);

  const handleOpenConnectionEmbeddingVisualizationOpen = useCallback(() => {
    eventBus.dispatch(EVENT_BUS_TYPE.OPEN_CONNECTION_EMBEDDING_VISUALIZATION);
  }, []);

  const handleReturnConnectionsHome = useCallback(() => {
    togglePageSlugId(CONNECTION_PAGE_SLUG_ID.ALL);
    modifyLocalBar([BAR_TYPE.CONNECTION]);
  }, [togglePageSlugId, modifyLocalBar]);

  const renderLeftChildren = useCallback(() => {
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
      return (
        <div className="w-100 text-truncate">{title}</div>
      );
    }
    const connectionTitle = gettext('Connections') + ' / ' + connectionName;
    return (
      <>
        <IconButton
          icon="down"
          className="rotate-icon-90 sea-qa-project-toggle-connections-btn"
          onClick={handleReturnConnectionsHome}
        />
        <span className="text-truncate" title={connectionTitle}>{connectionTitle}</span>
      </>
    );
  }, [pageSlugId, title, connectionName, handleReturnConnectionsHome]);

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
      return (<AddButton onClick={handleNewConnection} text={gettext('New connection')} icon="add" />);
    }
    return (
      <>
        {(connectionType === CONNECTION_TYPE.GITHUB_ISSUE || connectionType === CONNECTION_TYPE.DISCOURSE_FORUM) && (
          <AddButton onClick={handleOpenConnectionEmbeddingVisualizationOpen} text={gettext('Analyze')} className="mr-4" />
        )}
        <AddButton onClick={() => onManualSync(pageSlugId)} text={gettext('Sync now')} icon="sync" />
      </>
    );
  }, [pageSlugId, connectionType, handleNewConnection, onManualSync, handleOpenConnectionEmbeddingVisualizationOpen]);

  return (
    <BasicTopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </BasicTopBar>
  );
};

export default TopBar;
