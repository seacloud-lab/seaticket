import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CenteredError, CenteredLoading, IconButton } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { EmailThreadDetails } from '@/project/main-panel/connections/components/connection-resource-details';
import SeaMetadata, { useMetadataController } from '@/sea-metadata';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { CANVAS_RIGHT_INTERVAL, SEQUENCE_COLUMN_WIDTH } from '@/sea-metadata/constants/view/table';
import { portalAPI } from '../../api';
import { buildPortalPath, getPortalPathSegments } from '../../path-utils';
import {
  EMAIL_COLUMN_WIDTHS, EMAIL_COLUMNS, EMAIL_VIEWS_DATA, EMAIL_VIEW_DATA, EMAIL_TABLE_NAME,
  EMAIL_LOCAL_STORAGE_PREFIX, EMAIL_COLUMN_ORDER,
} from './constants';

const TeamEmails = ({ projectUuid }) => {
  const controller = useMetadataController();
  const metadataContainerRef = useRef(null);
  const metadataContentWidthRef = useRef(0);
  const [thread, setThread] = useState(null);
  const [threadContext, setThreadContext] = useState(null);
  const [error, setError] = useState('');
  const [isLoadingThread, setIsLoadingThread] = useState(() => {
    const segments = getPortalPathSegments();
    return segments[0] === 'emails' && segments.length === 3;
  });

  const loadThread = useCallback((connectionId, threadId) => {
    setIsLoadingThread(true);
    setError('');
    setThread(null);
    setThreadContext({ connectionId, threadId });
    portalAPI.getPortalEmailThread(projectUuid, connectionId, threadId).then((response) => {
      setThread(response.data.record);
    }).catch(() => {
      setError(gettext('Unable to load this email thread.'));
    }).finally(() => setIsLoadingThread(false));
  }, [projectUuid]);

  const openThread = useCallback((record) => {
    const threadId = record.thread_id;
    history.replaceState(null, null, buildPortalPath('emails', record.connection_id, threadId));
    loadThread(record.connection_id, threadId);
  }, [loadThread]);

  const dataDidMount = useCallback((data) => {
    const subjectColumn = data.columns.find(column => column.name === 'title');
    if (subjectColumn) {
      const otherColumnsWidth = data.columns
        .filter(column => column !== subjectColumn)
        .reduce((total, column) => total + column.width, 0);
      subjectColumn.width = Math.max(
        EMAIL_COLUMN_WIDTHS.title,
        metadataContentWidthRef.current - otherColumnsWidth
      );
      subjectColumn.click = openThread;
    }
  }, [openThread]);

  useEffect(() => {
    const container = metadataContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      const availableColumnWidth = Math.max(
        0,
        container.clientWidth - SEQUENCE_COLUMN_WIDTH - CANVAS_RIGHT_INTERVAL
      );
      if (availableColumnWidth === metadataContentWidthRef.current) return;
      metadataContentWidthRef.current = availableColumnWidth;
      setTimeout(() => controller.events.dispatch(EVENT_BUS_TYPE.RELOAD_DATA), 0);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [controller]);

  const listAPI = useMemo(() => ({
    getMetadata: ({ start = 0, limit = 1000 } = {}) => portalAPI.listTeamEmails(projectUuid, { start, limit }).then((response) => {
      const records = response.data.records || [];
      return {
        data: {
          rows: records.map(record => ({
            ...record,
            thread_id: record._pk,
            _pk: `${record.connection_id}:${record._pk}`,
          })),
          columns: EMAIL_COLUMNS,
          has_more: response.data.has_more,
          error_msg: records.length === 0 ? gettext('No emails.\nSupport emails from your team will appear here.') : '',
        },
      };
    }),
    getViews: () => Promise.resolve({ data: EMAIL_VIEWS_DATA }),
    getView: () => Promise.resolve({ data: { view: EMAIL_VIEW_DATA } }),
  }), [projectUuid]);

  const closeThread = () => {
    history.replaceState(null, null, buildPortalPath('emails'));
    setThread(null);
    setThreadContext(null);
    setIsLoadingThread(false);
    setError('');
  };

  useEffect(() => {
    const segments = getPortalPathSegments();
    if (segments[0] === 'emails' && segments.length === 3) {
      loadThread(segments[1], segments[2]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectUuid]);

  if (isLoadingThread) return <CenteredLoading />;
  if (error && threadContext) {
    return (
      <div className="seaqa-portal-emails-thread d-flex o-hidden flex-1 flex-column">
        <div className="seaqa-project-panel-header seaqa-project-main-panel-header seaqa-portal-emails-thread-header">
          <div className="seaqa-project-main-panel-header-content">
            <div className="seaqa-project-main-panel-header-left">
              <div className="seaqa-project-main-panel-header-name">
                <IconButton icon="arrow-down" className="rotate-icon-90 mr-2" onClick={closeThread} />
              </div>
            </div>
          </div>
        </div>
        <CenteredError>{error}</CenteredError>
      </div>
    );
  }
  if (error) return <CenteredError>{error}</CenteredError>;

  if (thread && threadContext) {
    return (
      <div className="seaqa-portal-emails-thread d-flex o-hidden flex-1 flex-column">
        <div className="seaqa-project-panel-header seaqa-project-main-panel-header seaqa-portal-emails-thread-header">
          <div className="seaqa-project-main-panel-header-content">
            <div className="seaqa-project-main-panel-header-left">
              <div className="seaqa-project-main-panel-header-name">
                <IconButton icon="arrow-down" className="rotate-icon-90 mr-2" onClick={closeThread} />
                <span className="text-truncate" title={thread.title}>{thread.title}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="seaqa-portal-emails-thread-content p-4 gap-4 flex-1 o-auto">
          <EmailThreadDetails
            details={thread.emails || []}
            projectUuid={projectUuid}
            connection_id={threadContext.connectionId}
            recordId={threadContext.threadId}
            threadId={threadContext.threadId}
            permission={PERMISSION_TYPES.READ_ONLY}
            isPortal={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="seaqa-portal-team-emails-metadata" ref={metadataContainerRef}>
      <SeaMetadata
        controller={controller}
        storageNamespace="primary"
        metadataID={`${EMAIL_TABLE_NAME}-${projectUuid}`}
        api={listAPI}
        permission={PERMISSION_TYPES.READ_ONLY}
        localStorageNamePrefix={`${EMAIL_LOCAL_STORAGE_PREFIX}-${projectUuid}`}
        viewTools={[]}
        isShowViewInURL={false}
        dataDidMount={dataDidMount}
        fixedColumnCount={1}
        settings={{
          canManageView: false,
          canClearCells: false,
          canPasteCells: false,
          canDragFillCells: false,
          isShowViews: false,
        }}
        columnOrderRules={EMAIL_COLUMN_ORDER}
        columnWidthRules={EMAIL_COLUMN_WIDTHS}
        t={{
          row: gettext('email'),
          rows: gettext('emails'),
          Row: gettext('Email'),
          Rows: gettext('Emails'),
        }}
      />
    </div>
  );
};

export default TeamEmails;
