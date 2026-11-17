import React, { useCallback, useMemo, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { CenteredError, CenteredLoading, IconButton, ModalHeader } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { portalAPI } from '@/portal/api';
import { EmailThreadDetails } from '@/project/main-panel/connections/components/connection-resource-details';
import SeaMetadata, { CellType } from '@/sea-metadata';

import './customer-emails-modal.css';

const EMAIL_COLUMNS = [
  {
    key: 'subject',
    name: 'title',
    display_name: gettext('Subject'),
    type: CellType.TEXT,
    width: 540,
    frozen: true,
    is_name_column: true,
    editable: false,
  },
  {
    key: 'modified_time',
    name: 'modified_time',
    display_name: gettext('Last modified time'),
    type: CellType.MTIME,
    width: 220,
    editable: false,
  },
];

const CustomerEmailsModal = ({ projectUuid, customer, onClose }) => {
  const [thread, setThread] = useState(null);
  const [threadError, setThreadError] = useState('');
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  const openThread = useCallback((record) => {
    setThread(null);
    setThreadError('');
    setIsLoadingThread(true);
    portalAPI.getCustomerEmailThread(projectUuid, customer.id, record.connection_id, record.thread_id)
      .then((response) => {
        setThread({
          record: response.data.record,
          connectionId: record.connection_id,
          threadId: record.thread_id,
        });
      })
      .catch(() => setThreadError(gettext('Unable to load this email thread.')))
      .finally(() => setIsLoadingThread(false));
  }, [customer.id, projectUuid]);

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
          error_msg: records.length === 0 ? gettext('No emails') : '',
        },
      };
    }),
    getViews: () => Promise.resolve({ data: { views: [{ _id: 'all', type: 'view' }], navigation: [{ _id: 'all', type: 'view' }] } }),
    getView: () => Promise.resolve({ data: { view: { _id: 'all', type: 'table', name: gettext('Emails'), columns_keys: ['subject', 'modified_time'] } } }),
  }), [customer.id, projectUuid]);

  const dataDidMount = useCallback((data) => {
    const subjectColumn = data.columns.find(column => column.name === 'title');
    if (subjectColumn) subjectColumn.click = openThread;
  }, [openThread]);

  return (
    <Modal isOpen={true} toggle={onClose} className="portal-customer-emails-dialog">
      <ModalHeader toggle={onClose}>
        {thread && <IconButton icon="arrow-down" className="rotate-icon-90 mr-2" onClick={() => setThread(null)} />}
        {thread ? thread.record.title : gettext('Emails for {customer}').replace('{customer}', customer.name)}
      </ModalHeader>
      <ModalBody>
        {isLoadingThread ? (
          <CenteredLoading />
        ) : threadError ? (
          <CenteredError>{threadError}</CenteredError>
        ) : thread ? (
          <div className="portal-customer-email-thread">
            <EmailThreadDetails
              details={thread.record.emails || []}
              projectUuid={projectUuid}
              customerId={customer.id}
              connection_id={thread.connectionId}
              recordId={thread.threadId}
              threadId={thread.threadId}
              permission={PERMISSION_TYPES.READ_ONLY}
            />
          </div>
        ) : (
          <div className="portal-customer-emails-list">
            <SeaMetadata
              metadataID={`customer-emails-${projectUuid}-${customer.id}`}
              api={listAPI}
              permission={PERMISSION_TYPES.READ_ONLY}
              localStorageNamePrefix={`seaqa-customer-emails-${projectUuid}-${customer.id}`}
              viewTools={[]}
              isShowViewInURL={false}
              dataDidMount={dataDidMount}
              fixedColumnCount={1}
              settings={{ canManageView: false, canClearCells: false, canPasteCells: false, canDragFillCells: false, isShowViews: false }}
              t={{ row: gettext('email'), rows: gettext('emails'), Row: gettext('Email'), Rows: gettext('Emails') }}
            />
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default CustomerEmailsModal;
