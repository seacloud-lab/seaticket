import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { Collaborator, ModalHeader } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { portalAPI } from '@/portal/api';
import { TICKET_STATE_OPTIONS } from '@/project/main-panel/tickets/constants';
import { getInternalNetworkAddress } from '@/project/utils';
import SeaMetadata, { CellType, useMetadataController } from '@/sea-metadata';
import NumberFormatter from '@/sea-metadata/components/cell-formatter/number';
import { EVENT_BUS_TYPE } from '@/sea-metadata/constants';
import { CANVAS_RIGHT_INTERVAL, SEQUENCE_COLUMN_WIDTH } from '@/sea-metadata/constants/view/table';
import { withSeaMetadataController } from '@/sea-metadata/controller-provider';


import './customer-emails-modal.css';

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

const CustomerEmailsModal = ({ projectUuid, customer, onClose }) => {
  const controller = useMetadataController();
  const modalRef = useRef(null);
  const [modalElement, setModalElement] = useState(null);
  const metadataContentWidthRef = useRef(0);
  const onOpened = useCallback(() => setModalElement(modalRef.current), []);

  const openThread = useCallback((record) => {
    const { workspaceID, projectName } = window.app.pageOptions;
    const threadURL = getInternalNetworkAddress('connection', record.thread_id, {
      workspaceID,
      projectName,
      connectionID: record.connection_id,
    });
    window.open(threadURL, '_blank', 'noopener,noreferrer');
  }, []);

  const listAPI = useMemo(() => ({
    getMetadata: ({ start = 0, limit = 1000 } = {}) => portalAPI.listCustomerEmails(
      projectUuid,
      customer.id,
      { start, limit },
    ).then((response) => {
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
    getViews: () => Promise.resolve({ data: { views: [{ _id: 'all', type: 'view' }], navigation: [{ _id: 'all', type: 'view' }] } }),
    getView: () => Promise.resolve({ data: { view: { _id: 'all', type: 'table', name: gettext('All emails'), columns_keys: EMAIL_COLUMNS.map(column => column.key) } } }),
  }), [customer.id, projectUuid]);

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
    const container = modalElement?.querySelector('.modal-body');
    if (!container || typeof ResizeObserver === 'undefined') return undefined;

    let reloadTimer;
    const observer = new ResizeObserver(() => {
      const availableColumnWidth = Math.max(
        0,
        container.clientWidth - SEQUENCE_COLUMN_WIDTH - CANVAS_RIGHT_INTERVAL
      );
      if (availableColumnWidth === metadataContentWidthRef.current) return;
      metadataContentWidthRef.current = availableColumnWidth;
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => controller.events.dispatch(EVENT_BUS_TYPE.RELOAD_DATA), 0);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(reloadTimer);
    };
  }, [controller, modalElement]);

  return (
    <Modal innerRef={modalRef} onOpened={onOpened} isOpen={true} toggle={onClose} className="portal-customer-emails-dialog">
      <ModalHeader toggle={onClose}>
        {gettext('Emails for {customer}').replace('{customer}', customer.name)}
      </ModalHeader>
      <ModalBody className="p-0">
        <SeaMetadata
          controller={controller}
          storageNamespace="primary"
          metadataID={`customer-emails-${projectUuid}-${customer.id}`}
          api={listAPI}
          permission={PERMISSION_TYPES.READ_ONLY}
          localStorageNamePrefix={`seaqa-customer-emails-${projectUuid}-${customer.id}`}
          viewTools={[]}
          isShowViewInURL={false}
          dataDidMount={dataDidMount}
          fixedColumnCount={1}
          settings={{ canManageView: false, canClearCells: false, canPasteCells: false, canDragFillCells: false, isShowViews: false }}
          columnOrderRules={EMAIL_COLUMN_ORDER}
          columnWidthRules={EMAIL_COLUMN_WIDTHS}
          t={{ row: gettext('email'), rows: gettext('emails'), Row: gettext('Email'), Rows: gettext('Emails') }}
        />
      </ModalBody>
    </Modal>
  );
};

export default withSeaMetadataController(CustomerEmailsModal);
