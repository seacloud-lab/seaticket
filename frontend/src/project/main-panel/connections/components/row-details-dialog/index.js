import { useCallback, useState, useEffect, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import { ModalHeader, IconTooltip, CenteredError, CenteredLoading, IconButton } from '@/components';
import { gettext } from '@/constants';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { CONNECTION_TYPE } from '../../constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getOriginalPageUrl, initConnectionRecordDetail } from '../../utils';
import { useConnections } from '../../hooks';
import Details from './details';

import './index.css';

const RowDetailsDialog = ({
  projectUuid, connection, row, columns,
  switchRow, onToggle,
}) => {
  const [rowDetails, setRowDetails] = useState(null);
  const [errMessage, setErrMessage] = useState('');
  const [status, setStatus] = useState(''); // 'loading', 'error', 'loaded'

  const { connections } = useConnections();

  const rowTitle = useMemo(() => {
    const titleColumn = getColumnByName(columns, 'title');
    let title = getCellValueByColumn(row, titleColumn);
    if (!title) {
      const filenameColumn = getColumnByName(columns, 'filename');
      title = getCellValueByColumn(row, filenameColumn);
    }
    return title;
  }, [row, columns]);

  const displayedTitle = useMemo(() => {
    if (status === 'loaded' && rowDetails) {
      return rowDetails.title || rowTitle;
    }
    return rowTitle;
  }, [status, rowDetails, rowTitle]);

  const url = useMemo(() => {
    const validConnection = connections.find(c => c.id === connection.id);
    if (!validConnection) return '';
    return getOriginalPageUrl(validConnection, row, columns);
  }, [connection, connections, row, columns]);

  const getFormatParamsByType = useCallback((row) => {
    if (connection.type === CONNECTION_TYPE.SITE) {
      const urlColumn = getColumnByName(columns, 'url');
      return { url: getCellValueByColumn(row, urlColumn), _pk: row._id };
    }
    return { _pk: row._id };
  }, [connection, columns]);

  const getRowDetails = useCallback(() => {
    setStatus('loading');
    const params = getFormatParamsByType(row);
    connectionsAPI.getConnectionRowDetail(projectUuid, connection.id, params).then((res) => {
      const detailData = initConnectionRecordDetail(res.data);
      setRowDetails(detailData);
      setStatus('loaded');
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrMessage(errMessage);
      setStatus('error');
    });
  }, [projectUuid, row, connection, getFormatParamsByType]);

  const handleSwitchRows = Utils.debounce(useCallback((step) => {
    switchRow(step);
  }, [switchRow]), 300);

  const onClose = useCallback(() => {
    onToggle && onToggle();
    setRowDetails(null);
  }, [onToggle]);

  useEffect(() => {
    getRowDetails();
  }, [projectUuid, row, connection]);

  return (
    <Modal className="sea-qa-row-details-container" isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>
        <div className="d-flex align-items-center">
          <div className="row-expand-direct-icons user-select-none mr-2">
            <IconTooltip
              icon="down"
              tip={gettext('Previous record')}
              className="direct-icon rotate-icon-180"
              placement="bottom"
              onClick={() => handleSwitchRows(-1)}
            />
            <IconTooltip
              icon="down"
              tip={gettext('Next record')}
              className="direct-icon"
              placement="bottom"
              onClick={() => handleSwitchRows(1)}
            />
          </div>
          <div className="text-truncate" title={displayedTitle}>{displayedTitle}</div>
          {url && (
            <IconButton
              className="open-in-new-tab-btn"
              icon="open-in-new-tab"
              title={gettext('Open in new tab')}
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            />
          )}
        </div>
      </ModalHeader>
      <ModalBody>
        {status === 'loading' && (
          <CenteredLoading />
        )}
        {status === 'error' && (
          <CenteredError>{errMessage}</CenteredError>
        )}
        {status === 'loaded' && (
          <Details details={rowDetails?.details} type={connection.type} projectUuid={projectUuid} connection={connection} />
        )}
      </ModalBody>
    </Modal>
  );
};

export default RowDetailsDialog;
