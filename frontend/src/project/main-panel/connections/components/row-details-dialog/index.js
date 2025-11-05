import { useMemo, useCallback, useState, useEffect, useRef, Fragment } from 'react';
import { Modal, ModalBody, UncontrolledTooltip } from 'reactstrap';
import dayjs from 'dayjs';
import { EmptyTip, ModalHeader, Icon, Loading } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { isObject } from '@/utils/type-detection';
import MarkdownViewer from '@/sea-metadata/components/cell-formatter/long-text/long-text-preview/viewer';
import { connectionsAPI } from '@/project/api';
import { CONNECTION_TYPE } from '../../constants';

import './index.css';

const SUPPORT_DETAILS_CONNECTION_TYPE = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.SEAFILE,
];

const RowDetailsDialog = ({ 
  projectUuid, connection, currentRow, seaMetaDataRef,
  setIsShowRowDetailsDialog
}) => {
  const currentRowRef = useRef(null);
  const [rowDetails, setRowDetails] = useState(null);
  const [rowDetailsTitle, setRowDetailsTitle] = useState('');
  const [status, setStatus] = useState(''); // 'loading', 'error', 'loaded'

  const getRowDetails = useCallback((row) => {
    setStatus('loading');
    if (SUPPORT_DETAILS_CONNECTION_TYPE.includes(connection.type)) {
      setRowDetailsTitle(row.title || row.filename);
      connectionsAPI.getConnectionRowDetail(projectUuid, connection.id, { _pk: row._id }).then((res) => {
        let detailData = null;
        if (connection.type === CONNECTION_TYPE.SEAFILE) {
          detailData = {
            body: res.data.row_details[0].content,
          };
        } else {
          detailData = res.data.row_details.map(detail => ({
            ...detail,
            time: detail.created_at || detail.updated_at,
            body: detail.body || detail.content,
          }));
        }
        setRowDetails(detailData);
        setStatus('loaded');
      }).catch(() => {
        setStatus('error');
      })
    }
  }, [projectUuid, connection]);

  const handleSwitchRows = useCallback((count) => {
    const rowsData = seaMetaDataRef.current.getOrderRows();
    const index = rowsData.findIndex(r => r._id === currentRowRef.current);
    if (index === -1) return;

    let newIndex = index + count;
    if (newIndex > rowsData.length - 1) {
      newIndex = 0;
    }
    if (newIndex < 0) {
      newIndex = rowsData.length - 1;
    }
    const currentRow = rowsData[newIndex];
    currentRowRef.current = currentRow._id;
    getRowDetails(currentRow);
  }, [projectUuid, connection, seaMetaDataRef]);

  const onClose = useCallback(() => {
    setIsShowRowDetailsDialog(false);
    setRowDetails(null);
    setRowDetailsTitle('');
    currentRowRef.current = null
  }, []);

  useEffect(() => {
    currentRowRef.current = currentRow._id;
    getRowDetails(currentRow)
  }, [])

  return (
    <Modal className="sea-qa-row-details-container" isOpen={true} toggle={onClose} style={{ minWidth: 800 }}>
      <ModalHeader toggle={onClose}>
        <div className="d-flex align-items-center">
          <div className="row-expand-direct-icons mr-2">
            <span
              id="sea-qa-row-details-prev-record-btn"
              className="direct-icon rotate-icon-180"
              onClick={() => handleSwitchRows(-1)}
            >
              <Icon symbol="down" />
            </span>
            <span
              id="sea-qa-row-details-next-record-btn"
              className="direct-icon"
              onClick={() => handleSwitchRows(1)}
            >
              <Icon symbol="down" />
            </span>
            <UncontrolledTooltip
              placement="bottom"
              target="sea-qa-row-details-prev-record-btn"
              fade={false}
              trigger="hover"
              className="sea-metadata-tooltip"
            >
              {gettext('Previous record')}
            </UncontrolledTooltip>
            <UncontrolledTooltip
              placement="bottom"
              target="sea-qa-row-details-next-record-btn"
              fade={false}
              trigger="hover"
              className="sea-metadata-tooltip"
            >
              {gettext('Next record')}
            </UncontrolledTooltip>
          </div>
          <div className="text-truncate flex-1" title={rowDetailsTitle}>{rowDetailsTitle}</div>
        </div>
      </ModalHeader>
      <ModalBody>
        {status === 'loading' && (
          <div className="h-100 d-flex align-items-center justify-content-center">
            <Loading/>
          </div>
        )}
        {status === 'error' && (
          <div className="h-100 d-flex align-items-center justify-content-center">
            <span className="error" dangerouslySetInnerHTML={{ __html: status }}></span>
          </div>
        )}
        {status === 'loaded' && (
          <Fragment>
            {connection.type === CONNECTION_TYPE.SEAFILE && rowDetails && (
              <Fragment>
                {!rowDetails.body && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
                {rowDetails.body && (<MarkdownViewer value={rowDetails.body} showTOC={false} />)}
              </Fragment>
            )}
            {connection.type !== CONNECTION_TYPE.SEAFILE && rowDetails && (
              <div className="sea-qa-row-details-non-seafile">
                {rowDetails.length === 0 && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
                {rowDetails.length > 0 && (
                  <Fragment>
                    {rowDetails.map(detail => (
                      <div key={detail.id} className="sea-qa-row-details-reply-item">
                        <div className="author-info-wrapper">
                          <div className="author-info-left">
                            <div className="author-avatar">
                              <img alt='' src={`${mediaUrl}avatars/default.png`}/>
                            </div>
                            <div className="author-name">{detail.author}</div>
                          </div>
                          <div className="author-time" title={formatWithTimezone(detail.time)}>
                            {dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </div>
                        </div>
                        <div className="reply-item-content" dangerouslySetInnerHTML={{ __html: detail.body }} />
                      </div>
                    ))}
                  </Fragment>
                )}
              </div>
            )}
          </Fragment>
        )}
      </ModalBody>
    </Modal>
  );
};

export default RowDetailsDialog;
