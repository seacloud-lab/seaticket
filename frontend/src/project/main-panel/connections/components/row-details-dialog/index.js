import { useCallback, useState, useEffect, Fragment, useMemo } from 'react';
import { Modal, ModalBody } from 'reactstrap';
import dayjs from 'dayjs';
import { EmptyTip, ModalHeader, IconTooltip, CenteredError, CenteredLoading, IconButton } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { formatWithTimezone } from '@/sea-metadata/utils/column';
import { MarkdownViewer } from '@seafile/seafile-editor';
import { connectionsAPI } from '@/project/api';
import { Utils } from '@/utils/utils';
import { CONNECTION_TYPE, SUPPORT_ROW_DETAILS_CONNECTION_TYPES } from '../../constants';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getOriginalPageUrl } from '../../utils';
import { useConnections } from '../../hooks';

import './index.css';

const SUPPORT_DETAILS_LIST = [
  CONNECTION_TYPE.GITHUB_ISSUE,
  CONNECTION_TYPE.DISCOURSE_FORUM,
  CONNECTION_TYPE.EMAIL,
];

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

  const getFormatDetailDataByType = useCallback((res) => {
    // Format data according to different connection types,site and seafile only have one detail content
    const mainTitle = res.data.title;
    if (connection.type === CONNECTION_TYPE.SITE || connection.type === CONNECTION_TYPE.SEAFILE) {
      return {
        title: mainTitle,
        time: res.data.modified_time,
        body: res.data.content };
    } else if (connection.type === CONNECTION_TYPE.GITHUB_ISSUE) {
      const mainPost = {
        author: res.data.author,
        time: res.data.created_time,
        body: res.data.content || '',
      };
      const comments = res.data.comments?.map(detail => ({
        ...detail,
        time: detail.created_time,
        body: detail.content || '',
      }));
      return {
        title: mainTitle,
        displayedData: [mainPost, ...comments]
      };
    } else if (connection.type === CONNECTION_TYPE.DISCOURSE_FORUM) {
      return {
        title: mainTitle,
        displayedData: res.data.replies?.map(detail => ({
          ...detail,
          time: detail.modified_time,
          body: detail.content || '',
        })),
      };
    } else if (connection.type === CONNECTION_TYPE.EMAIL) {
      return {
        title: mainTitle,
        displayedData: res.data.emails?.map(detail => ({
          ...detail,
          time: detail.modified_time,
          body: detail.content || '',
        })),
      };
    }
  }, [connection]);

  const getRowDetails = useCallback(() => {
    setStatus('loading');
    if (SUPPORT_ROW_DETAILS_CONNECTION_TYPES.includes(connection.type)) {
      const params = getFormatParamsByType(row);
      connectionsAPI.getConnectionRowDetail(projectUuid, connection.id, params).then((res) => {
        const detailData = getFormatDetailDataByType(res);
        setRowDetails(detailData);
        setStatus('loaded');
      }).catch((error) => {
        const errMessage = Utils.getErrorMsg(error);
        setErrMessage(errMessage);
        setStatus('error');
      });
    }
  }, [projectUuid, row, connection]);

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

  const renderContentByType = useCallback((type, content) => {
    if (type === CONNECTION_TYPE.DISCOURSE_FORUM || type === CONNECTION_TYPE.EMAIL) {
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
          <Fragment>
            {!SUPPORT_DETAILS_LIST.includes(connection.type) && rowDetails && (
              <Fragment>
                {
                  rowDetails.body
                    ? <MarkdownViewer value={rowDetails.body} showTOC={false} />
                    : <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />
                }
              </Fragment>
            )}
            {SUPPORT_DETAILS_LIST.includes(connection.type) && rowDetails && (
              <div className="sea-qa-row-details-type-list">
                {rowDetails.displayedData.length === 0 && <EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />}
                {rowDetails.displayedData.length > 0 && (
                  <Fragment>
                    {rowDetails.displayedData.map(detail => (
                      <div key={detail.id} className="sea-qa-row-details-reply-item">
                        <div className="author-info-wrapper">
                          <div className="author-info-left">
                            <div className="author-avatar">
                              <img alt='' src={`${mediaUrl}avatars/default.png`}/>
                            </div>
                            <div className="author-name">{detail.author}</div>
                          </div>
                          <div className="author-time" title={formatWithTimezone(detail.time)}>
                            {dayjs(detail.time).format('YYYY-MM-DD HH:mm:ss')}
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
