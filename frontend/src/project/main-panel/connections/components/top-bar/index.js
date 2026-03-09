import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from '@/utils/dayjs';
import { Button } from 'reactstrap';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '../../../../api';
import BasicTopBar from '../../../top-bar';
import { useConnectionsPage, useConnections } from '../../hooks';
import { CONNECTION_PAGE_SLUG_ID, CONNECTION_SYNC_STATUS } from '../../constants';
import { IconButton, toaster, CenteredLoading, IconTextBtn } from '@/components';
import { gettext } from '@/constants';
import eventBus from '@/utils/event-bus';
import { EVENT_BUS_TYPE } from '@/project/constants';
import { AddButton, RefreshBtn } from '@/project/components';
import { BAR_TYPE } from '../../../../constants';
import { initConnectionStatus, isConnectionRecordsView } from '../../utils';
import context from '@/sea-metadata/context';
import { EVENT_BUS_TYPE as SEA_METADATA_EVENT_BUS_TYPE } from '@/sea-metadata/constants';

import './index.css';

const { server, projectUuid, isProjectAdmin } = window.app.pageOptions;

const TopBar = ({ title, modifyLocalBar }) => {
  const { pageSlugId, childrenPageSlugId, togglePageSlugId, toggleChildrenPageSlugId, onRefresh } = useConnectionsPage();
  const { modifyLocalConnectionsSyncStatus, connections } = useConnections();
  const timer = useRef(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const connectionName = useMemo(() => {
    const connection = connections.find(c => c.id === pageSlugId);
    return connection?.name || '';
  }, [connections, pageSlugId]);

  const handleNewConnection = useCallback(() => {
    eventBus.dispatch(EVENT_BUS_TYPE.NEW_CONNECTION);
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
    let connectionTitle = gettext('Connections') + ' / ' + connectionName;
    if (childrenPageSlugId) {
      connectionTitle = connectionTitle + ' / #' + childrenPageSlugId;
      return (
        <>
          <IconButton
            icon="arrow-down"
            className="rotate-icon-90 sea-qa-project-toggle-connections-btn"
            onClick={() => toggleChildrenPageSlugId('')}
          />
          <span className="text-truncate" title={connectionTitle}>{connectionTitle}</span>
        </>
      );
    }
    return (
      <>
        <IconButton
          icon="arrow-down"
          className="rotate-icon-90 sea-qa-project-toggle-connections-btn"
          onClick={handleReturnConnectionsHome}
        />
        <span className="text-truncate" title={connectionTitle}>{connectionTitle}</span>
        <RefreshBtn onClick={onRefresh} />
      </>
    );
  }, [pageSlugId, childrenPageSlugId, title, connectionName, handleReturnConnectionsHome, toggleChildrenPageSlugId, onRefresh]);

  const onManualSync = useCallback((connectionID) => {
    connectionsAPI.triggerSync(projectUuid, connectionID).then(() => {
      setIsSyncing(true);
      const onQueryConnectionStatus = (connectionID) => {
        timer.current = setTimeout(() => {
          connectionsAPI.queryConnectionsStatus(projectUuid, [connectionID]).then((res) => {
            const { status } = res.data[connectionID];
            const { last_sync_status, last_sync_count } = initConnectionStatus(status);
            let callback = null;
            if (last_sync_status === CONNECTION_SYNC_STATUS.COMPLETED && last_sync_count > 0) {
              callback = () => {
                const eventBus = context.eventBus;
                eventBus.dispatch(SEA_METADATA_EVENT_BUS_TYPE.RELOAD_DATA, false);
              };
            }
            modifyLocalConnectionsSyncStatus(res.data, callback);
            if (last_sync_status === CONNECTION_SYNC_STATUS.COMPLETED) {
              clearTimeout(timer.current);
              timer.current = null;
              if (last_sync_count > 0) {
                const msg = gettext('%s records synced').replace('%s', last_sync_count);
                toaster.success(msg);
              } else {
                toaster.success(gettext('No new records'));
              }
              setIsSyncing(false);
            } else if (last_sync_status === CONNECTION_SYNC_STATUS.FAILED) {
              clearTimeout(timer.current);
              timer.current = null;
              toaster.danger(gettext('Sync failed'));
              setIsSyncing(false);
            } else {
              onQueryConnectionStatus(connectionID);
            }
          }).catch((error) => {
            setIsSyncing(false);
            const errorMessage = Utils.getErrorMsg(error);
            toaster.danger(errorMessage);
            modifyLocalConnectionsSyncStatus({
              [connectionID]: { status: { last_sync_status: CONNECTION_SYNC_STATUS.FAILED }, last_sync_time: null }
            });
          });
        }, 3000);
      };
      modifyLocalConnectionsSyncStatus({
        [connectionID]: { status: { last_sync_status: CONNECTION_SYNC_STATUS.PENDING }, last_sync_time: null }
      });
      onQueryConnectionStatus(connectionID);
    }).catch((error) => {
      const errorMessage = Utils.getErrorMsg(error);
      let error_msg = '';
      if (errorMessage.message_type === 'Manual sync too frequent') {
        const next_time = errorMessage.next_time ? dayjs(errorMessage.next_time).format('YYYY-MM-DD HH:mm:ss') : '--';
        error_msg = errorMessage.message_type + '. Next time:' + next_time;
      } else {
        error_msg = errorMessage;
      }
      setIsSyncing(false);
      toaster.danger(error_msg);
    });
  }, [projectUuid, modifyLocalConnectionsSyncStatus, onRefresh]);

  const renderRightChildren = useCallback(() => {
    if (pageSlugId === CONNECTION_PAGE_SLUG_ID.ALL) {
      const currentPath = window.location.pathname + window.location.search;
      const installGitHubAppURL = `${server}/github/install/?next=${encodeURIComponent(currentPath)}&project_uuid=${projectUuid}`;

      return (
        <>
          {isProjectAdmin && (<IconTextBtn text={gettext('Install GitHub app')} onClick={() => location.href = installGitHubAppURL} />)}
          <IconTextBtn onClick={handleNewConnection} text={gettext('New connection')} icon="connection" />
        </>
      );
    }
    if (isConnectionRecordsView(pageSlugId) && childrenPageSlugId) return null;
    return (
      <>
        {isSyncing
          ?
          (
            <Button className='sea-qa-project-syncing-connections-btn' disabled={true} color="primary">
              <CenteredLoading className='mr-2' />
              <span>{gettext('Syncing')}</span>
            </Button>
          )
          : <AddButton onClick={() => onManualSync(pageSlugId)} text={gettext('Sync now')} icon="sync" />}
      </>
    );
  }, [pageSlugId, childrenPageSlugId, isSyncing, handleNewConnection, onManualSync]);

  useEffect(() => {
    return () => {
      timer.current && clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  useEffect(() => {
    timer.current && clearTimeout(timer.current);
    timer.current = null;
    setIsSyncing(false);
  }, [pageSlugId]);

  return (
    <BasicTopBar>
      {renderLeftChildren()}
      {renderRightChildren()}
    </BasicTopBar>
  );
};

export default TopBar;
