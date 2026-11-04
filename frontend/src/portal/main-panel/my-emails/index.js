import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CenteredError, CenteredLoading, Collaborator, IconButton } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { EmailThreadDetails } from '@/project/main-panel/connections/components/connection-resource-details';
import { TICKET_STATE_OPTIONS } from '@/project/main-panel/tickets/constants';
import SeaMetadata, { CellType } from '@/sea-metadata';
import NumberFormatter from '@/sea-metadata/components/cell-formatter/number';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { CANVAS_RIGHT_INTERVAL, SEQUENCE_COLUMN_WIDTH } from '@/sea-metadata/constants/view/table';
import context from '@/sea-metadata/context';
import { portalAPI } from '../../api';
import { buildPortalPath, getPortalPathSegments } from '../../path-utils';

const EMAIL_TABLE_NAME = 'portal_emails';
const EMAIL_LOCAL_STORAGE_PREFIX = 'seaqa-portal-emails';
const EMAIL_VIEW = { _id: 'all', name: gettext('All emails') };
const EMAIL_COLUMN_ORDER = {
  title: 1,
  ticket_pk: 2,
  state: 3,
  assignees: 4,
  due_date: 5,
  modified_time: 6,
};
const EMAIL_COLUMN_WIDTHS = {
  title: 320,
  ticket_pk: 120,
  state: 120,
  assignees: 200,
  due_date: 200,
  modified_time: 200,
};
const AssigneesFormatter = ({ value = [] }) => (
  <div className="collaborators-formatter">
    {value.map(assignee => <Collaborator key={assignee.email} collaborator={assignee} />)}
  </div>
);
const TicketNumberFormatter = ({ value }) => value === null || value === undefined || value === ''
  ? <div className="sea-metadata-ui cell-formatter-container text-formatter number-formatter">--</div>
  : <NumberFormatter value={`#${value}`} />;
const EMAIL_COLUMNS = [
  {
    key: 'subject',
    name: 'title',
    display_name: gettext('Subject'),
    type: CellType.TEXT,
    width: 320,
    frozen: true,
    is_name_column: true,
    editable: false,
  },
  {
    key: 'ticket',
    name: 'ticket_pk',
    display_name: gettext('Ticket #'),
    type: CellType.NUMBER,
    width: 120,
    editable: false,
    formatter: <TicketNumberFormatter />,
  },
  {
    key: 'state',
    name: 'state',
    display_name: gettext('State'),
    type: CellType.SINGLE_SELECT,
    width: 120,
    editable: false,
    data: { options: TICKET_STATE_OPTIONS },
  },
  {
    key: 'assignees',
    name: 'assignees',
    display_name: gettext('Assignees'),
    type: CellType.COLLABORATOR,
    width: 200,
    editable: false,
    formatter: <AssigneesFormatter />,
  },
  {
    key: 'due_date',
    name: 'due_date',
    display_name: gettext('Due date'),
    type: CellType.DATE,
    width: 200,
    editable: false,
    data: { format: 'YYYY-MM-DD' },
  },
  {
    key: 'modified_time',
    name: 'modified_time',
    display_name: gettext('Last modified time'),
    type: CellType.MTIME,
    width: 200,
    editable: false,
  },
];

const EMAIL_VIEWS_DATA = {
  navigation: [{ _id: EMAIL_VIEW._id, type: 'view' }],
  views: [EMAIL_VIEW],
};

const EMAIL_VIEW_DATA = {
  ...EMAIL_VIEW,
  columns_keys: EMAIL_COLUMNS.map(column => column.key),
};

const MyEmails = ({ projectUuid }) => {
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
      setTimeout(() => context.eventBus.dispatch(EVENT_BUS_TYPE.RELOAD_DATA), 0);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const listAPI = useMemo(() => ({
    getMetadata: ({ start = 0, limit = 1000 } = {}) => portalAPI.listMyEmails(projectUuid, { start, limit }).then((response) => {
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
      <div className="seaqa-portal-emails-thread">
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
      <div className="seaqa-portal-emails-thread">
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
        <div className="seaqa-portal-emails-thread-content">
          <EmailThreadDetails
            details={thread.emails || []}
            projectUuid={projectUuid}
            connection_id={threadContext.connectionId}
            recordId={threadContext.threadId}
            threadId={threadContext.threadId}
            permission={PERMISSION_TYPES.READ_ONLY}
            isPortal={true}
            className="pt-4 pb-4"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="seaqa-portal-my-emails-metadata" ref={metadataContainerRef}>
      <SeaMetadata
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

export default MyEmails;
