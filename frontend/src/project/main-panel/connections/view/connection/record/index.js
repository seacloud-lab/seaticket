import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { useConnectionsPage } from '../../../hooks';
import { CenteredLoading, IconButton } from '@/components';
import { getTableName } from '../../../utils';
import { useData } from '@/project/hooks';
import { useConnections } from '../../../hooks';
import ConnectionResourceDetails from '../../../components/connection-resource-details';
import { getResourceOriginalURL } from '@/project/utils';
import { gettext } from '@/constants';

import './index.css';

const initColumns = [
  { key: 'filename', name: 'filename' },
  { key: 'path', name: 'path' },
  { key: 'title', name: 'title' },
  { key: 'url', name: 'url' },
  { key: 'slug', name: 'slug' },
  { key: 'topic_id', name: 'topic_id' },
];

const Record = ({ projectUuid }) => {
  const { isLoading: isConnectionsPageLoading, pageSlugId, childrenPageSlugId, updateConnectionInfo } = useConnectionsPage();
  const { getRow } = useData();
  const { connections } = useConnections();

  const [containerWidth, setContainerWidth] = useState(0);
  const [details, setDetails] = useState(null);

  const recordRef = useRef(null);

  const connection = useMemo(() => connections.find(c => c.id === pageSlugId), [pageSlugId, connections]);
  const resource = useMemo(() => ({ type: connection?.type, connection_id: pageSlugId, _id: childrenPageSlugId }), [connection, pageSlugId, childrenPageSlugId]);

  const cacheRecord = useMemo(() => {
    if (!connection) return '';
    const connectionTableName = getTableName(connection);
    const row = getRow(connectionTableName, childrenPageSlugId);
    return row;
  }, [connection, childrenPageSlugId, getRow]);

  const title = useMemo(() => {
    if (details && details.title) return details.title;
    if (!cacheRecord) return '';
    return cacheRecord.title;
  }, [details, cacheRecord]);

  const url = useMemo(() => {
    if (!connection) return '';
    if (!details) return '';
    return getResourceOriginalURL(connection.type, { ...details, ...resource }, connections, initColumns);
  }, [connection, connections, resource, details]);

  const updateDetails = useCallback((details) => {
    setDetails(details?.title ? details : '');
  }, [updateConnectionInfo]);

  useEffect(() => {
    if (isConnectionsPageLoading || !details) return;
    const recordDom = recordRef.current;
    const handleResize = () => {
      if (!recordDom) return;
      setContainerWidth(recordDom.offsetWidth);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    recordDom && resizeObserver.observe(recordDom);

    return () => {
      recordDom && resizeObserver.unobserve(recordDom);
    };
  }, [isConnectionsPageLoading, details]);

  if (isConnectionsPageLoading) return (<CenteredLoading />);

  // 904: details min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = details && containerWidth < 904;
  return (
    <div className={classnames('sea-connection-record-details', { 'small': isSmallScreen })} ref={recordRef}>
      {title && (
        <div className="sea-connection-record-details-header">
          <div className="text-truncate" title={title}>{title}</div>
          {url && (
            <IconButton
              className="open-in-new-tab-btn"
              icon="open-in-new-tab"
              title={gettext('Open the original URL in a new tab')}
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            />
          )}
        </div>
      )}
      <div className={classnames('sea-connection-record-details-body', { 'empty': !details })}>
        <div className="sea-connection-record-details-container">
          <ConnectionResourceDetails resource={resource} projectUuid={projectUuid} updateDetails={updateDetails} />
        </div>
        {details && (<div className="sea-connection-record-details-others"></div>)}
      </div>
    </div>
  );
};

export default Record;
