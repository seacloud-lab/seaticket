import { useCallback, useState, useEffect, useRef, Fragment } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { EmptyTip, ModalHeader, IconTooltip, CenteredError, CenteredLoading } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import MarkdownViewer from '@/sea-metadata/components/cell-formatter/long-text/long-text-preview/viewer';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
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
  const [errMessage, setErrMessage] = useState('');
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
      }).catch((error) => {
        const errMessage = Utils.getErrorMsg(error);
        setErrMessage(errMessage);
        setStatus('error');
      });
    }
  }, [projectUuid, connection]);

  const handleSwitchRows = Utils.debounce(useCallback((count) => {
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
  }, [projectUuid, connection, seaMetaDataRef]), 300);

  const onClose = useCallback(() => {
    setIsShowRowDetailsDialog(false);
    setRowDetails(null);
    setRowDetailsTitle('');
    currentRowRef.current = null;
  }, []);

  useEffect(() => {
    currentRowRef.current = currentRow._id;
    getRowDetails(currentRow);
  }, []);

  const renderContentByType = useCallback((type, content) => {
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return (
        <div className="reply-item-content" dangerouslySetInnerHTML={{ __html: content }} />
      );
    }
    return <MarkdownViewer value={content} showTOC={false} />;
  }, []);

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
          <div className="text-truncate flex-1" title={rowDetailsTitle}>{rowDetailsTitle}</div>
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
          <Fragment>
            {connection.type === CONNECTION_TYPE.SEAFILE && rowDetails && (
              <Fragment>
                {
                  rowDetails.body
                    ? renderContentByType(connection.type, rowDetails.body)
                    : <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />
                }
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
                        {renderContentByType(connection.type, detail.body)}
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
