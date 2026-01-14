import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { EmptyTip, CustomizeMarkdownViewer, CenteredLoading, CenteredError } from '@/components';
import { mediaUrl } from '@/constants';
import { CONNECTION_PREDEFINED_COLUMN_NAME, CONNECTION_TYPE } from '../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import { generatorConnectionAssetURLPrefix } from '../../utils';
import { initConnectionResourceDetails } from '../../utils';
import { Utils } from '@/utils/utils';
import { getColumnByName } from '@/sea-metadata/utils/column';
import { getCellValueByColumn } from '@/sea-metadata/utils/cell';
import { connectionsAPI } from '@/project/api';

import './index.css';

const ConnectionResourceDetails = ({ resource, columns, projectUuid, updateDetails }) => {
  const [status, setStatus] = useState('loading'); // loading / error / loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState(null);

  const type = useMemo(() => resource.type, [resource]);

  const getFormatParamsByType = useCallback((resource) => {
    if (resource.type === CONNECTION_TYPE.SITE) {
      const urlColumn = getColumnByName(columns, CONNECTION_PREDEFINED_COLUMN_NAME.URL);
      return { url: getCellValueByColumn(resource, urlColumn), _pk: resource._id };
    }
    return { _pk: resource._id };
  }, [columns]);

  useEffect(() => {
    setStatus('loading');
    const params = getFormatParamsByType(resource);
    connectionsAPI.getConnectionRowDetail(projectUuid, resource.connection_id, params).then((res) => {
      const details = initConnectionResourceDetails(resource.type, res.data);
      setDetails(details?.details);
      updateDetails(details);
      setStatus('loaded');
    }).catch((error) => {
      const errMessage = Utils.getErrorMsg(error);
      setErrorMessage(errMessage);
      setStatus('error');
    });
  }, [projectUuid, resource]);

  if (status === 'loading') return (<CenteredLoading />);
  if (status === 'error') return (<CenteredError>{errorMessage}</CenteredError>);

  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />);
    }
    if (type === CONNECTION_TYPE.EMAIL) {
      const assetURLPrefix = generatorConnectionAssetURLPrefix(projectUuid, resource.connection_id);
      return (
        <EmailDetails className="sea-ticket-connection-resource-details pt-4 pb-4" details={details} assetURLPrefix={assetURLPrefix}/>
      );
    }
    return (
      <div className="sea-ticket-connection-resource-details">
        {details.map((detail, index) => {
          return (
            <CommonDetailItem detail={detail} type={type} key={index} />
          );
        })}
      </div>
    );
  }

  if (details) {
    return (<CustomizeMarkdownViewer value={details} showTOC={false} />);
  }
  return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />);
};

export default ConnectionResourceDetails;
