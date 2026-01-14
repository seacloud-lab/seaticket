import React, { useEffect, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { useConnectionsPage } from '../../../hooks';
import { CenteredError, CenteredLoading } from '@/components';
import { connectionsAPI } from '../../../../../api';
import { Utils } from '@/utils/utils';
import { initConnectionResourceDetails, generatorConnectionAssetURLPrefix } from '../../../utils';
import { useDataCache } from '@/sea-metadata';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { getRowById } from '@/sea-metadata/utils/row';
import { CONNECTION_TYPE } from '../../../constants';
import { gettext } from '@/constants';
import EmailDetails from '../../../components/connection-resource-details/email-details';

import './index.css';

const Record = ({ projectUuid }) => {
  const { isLoading: isConnectionsPageLoading, pageSlugId, childrenPageSlugId, connectionInfo, updateConnectionInfo } = useConnectionsPage();
  const { cachedData } = useDataCache();

  const [isLoading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState('');
  const [containerWidth, setContainerWidth] = useState(0);

  const recordRef = useRef(null);

  const cachedTitle = useMemo(() => {
    const titleColumn = getColumnByName(cachedData?.columns || [], 'title');
    const record = getRowById(cachedData, childrenPageSlugId);
    let title = getCellValueByColumn(record, titleColumn);
    if (!title) {
      const filenameColumn = getColumnByName(cachedData?.columns, 'filename');
      title = getCellValueByColumn(record, filenameColumn);
    }
    return title;
  }, [cachedData, childrenPageSlugId]);

  const title = useMemo(() => {
    return data.title || cachedTitle;
  }, [data, cachedTitle]);

  const assetURLPrefix = useMemo(() => {
    return generatorConnectionAssetURLPrefix(projectUuid, pageSlugId);
  }, [projectUuid, pageSlugId]);

  useEffect(() => {
    connectionsAPI.getConnectionRowDetail(projectUuid, pageSlugId, { _pk: childrenPageSlugId }).then((res) => {
      const { connection_name, connection_type } = res.data;
      const data = initConnectionResourceDetails(connection_type, res.data);
      setData(data);
      updateConnectionInfo && updateConnectionInfo({ name: connection_name, type: connection_type, id: pageSlugId });
      setErrorMessage('');
      setLoading(false);
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setLoading(false);
    });
  }, [childrenPageSlugId]);

  useEffect(() => {
    if (isLoading || isConnectionsPageLoading || errorMessage || connectionInfo.type !== CONNECTION_TYPE.EMAIL) return;
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
  }, [isLoading, isConnectionsPageLoading, errorMessage, connectionInfo]);

  if (isConnectionsPageLoading) return null;
  if (isLoading) return (<CenteredLoading />);
  if (errorMessage) return (<CenteredError>{errorMessage}</CenteredError>);

  if (connectionInfo.type !== CONNECTION_TYPE.EMAIL) {
    return (<CenteredError>{gettext('Not support type')}</CenteredError>);
  }

  // 904: details min-width(596) + others min-width(260) + gap: 16 * 3
  const isSmallScreen = containerWidth < 904;
  const details = data?.details || [];
  return (
    <div className={classnames('sea-connection-record-details', { 'small': isSmallScreen })} ref={recordRef}>
      <div className="sea-connection-record-details-header text-truncate" title={title}>
        {title}
      </div>
      <div className="sea-connection-record-details-body">
        <EmailDetails details={details} className="sea-connection-record-details-container" assetURLPrefix={assetURLPrefix} />
        <div className="sea-connection-record-details-others"></div>
      </div>
    </div>
  );
};

export default Record;
