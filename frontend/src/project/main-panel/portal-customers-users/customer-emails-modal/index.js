import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext, PERMISSION_TYPES } from '@/constants';
import { portalAPI } from '@/portal/api';
import { EMAIL_COLUMN_ORDER, EMAIL_COLUMN_WIDTHS, EMAIL_COLUMNS, EMAIL_VIEWS_DATA, EMAIL_VIEW_DATA } from '@/portal/main-panel/team-emails/constants';
import ResourceDetailsDialog from '@/project/components/resource-details-dialog';
import { getInternalNetworkAddress } from '@/project/utils';
import SeaMetadata, { useMetadataController } from '@/sea-metadata';
import { withSeaMetadataController } from '@/sea-metadata/controller-provider';
import { CONNECTION_TYPE } from '../../connections/constants';

import './index.css';

const CustomerEmailsModal = ({ projectUuid, customer, onClose }) => {
  const controller = useMetadataController();

  const [currentRow, setCurrentRow] = useState({});
  const [isShowRowDetailsDialog, setIsShowRowDetailsDialog] = useState(false);

  const seaMetaDataRef = useRef(null);

  const columns = useMemo(() => {
    return EMAIL_COLUMNS.map(column => {
      if (column.key === 'subject') {
        column.click = (row) => {
          const { workspaceID, projectName } = window.app.pageOptions;
          const threadURL = getInternalNetworkAddress('connection', row.thread_id, {
            workspaceID,
            projectName,
            connectionID: row.connection_id,
          });
          window.open(threadURL, '_blank', 'noopener,noreferrer');
        };
      }
      return column;
    });
  }, []);

  const metadataAPI = useMemo(() => ({
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
            _pk: `${record.connection_id}_${record._pk}`,
          })),
          columns,
          has_more: response.data.has_more,
          error_msg: records.length === 0 ? gettext('No emails.\nSupport emails from your team will appear here.') : '',
        },
      };
    }),
    getViews: () => Promise.resolve({ data: EMAIL_VIEWS_DATA }),
    getView: () => Promise.resolve({ data: { view: EMAIL_VIEW_DATA } }),
  }), [customer.id, projectUuid, columns]);

  const handleExpandRow = useCallback((row) => {
    const { _pk } = row;
    const [, recordKey] = _pk.split('_');
    setCurrentRow({ ...row, key: _pk, _pk: recordKey, _id: recordKey, type: CONNECTION_TYPE.EMAIL });
    setIsShowRowDetailsDialog(true);
  }, []);

  const switchResource = useCallback((step) => {
    const rowsData = seaMetaDataRef.current.getOrderRows();
    const index = rowsData.findIndex(r => r._id === currentRow.key);
    if (index === -1) return;

    let newIndex = index + step;
    if (newIndex > rowsData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = rowsData.length - 1;
    }
    const row = rowsData[newIndex];
    setCurrentRow({ ...row, type: CONNECTION_TYPE.EMAIL });
  }, [currentRow, seaMetaDataRef]);

  return (
    <Modal isOpen={true} toggle={onClose} className="portal-customer-emails-dialog">
      <ModalHeader toggle={onClose}>
        {gettext('Emails for {customer}').replace('{customer}', customer.name)}
      </ModalHeader>
      <ModalBody className="p-0 d-flex o-hidden">
        <SeaMetadata
          ref={seaMetaDataRef}
          controller={controller}
          storageNamespace="primary"
          metadataID={`customer-emails-${projectUuid}-${customer.id}`}
          api={metadataAPI}
          permission={PERMISSION_TYPES.READ_ONLY}
          localStorageNamePrefix={`seaqa-customer-emails-${projectUuid}-${customer.id}`}
          viewTools={[]}
          isShowViewInURL={false}
          fixedColumnCount={1}
          settings={{ canManageView: false, canClearCells: false, canPasteCells: false, canDragFillCells: false, isShowViews: false }}
          columnOrderRules={EMAIL_COLUMN_ORDER}
          columnWidthRules={EMAIL_COLUMN_WIDTHS}
          t={{ row: gettext('email'), rows: gettext('emails'), Row: gettext('Email'), Rows: gettext('Emails') }}
          expandRow={handleExpandRow}
        />
        {isShowRowDetailsDialog && (
          <ResourceDetailsDialog
            projectUuid={projectUuid}
            permission={PERMISSION_TYPES.READ_ONLY}
            resource={currentRow}
            columns={EMAIL_COLUMNS}
            switchResource={switchResource}
            onToggle={() => setIsShowRowDetailsDialog(false)}
            createMoreOptions={() => []}
          />
        )}
      </ModalBody>
    </Modal>
  );
};

export default withSeaMetadataController(CustomerEmailsModal);
