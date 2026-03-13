import React, { useEffect, useMemo, useState } from 'react';
import { EmptyTip, CustomizeMarkdownViewer, CenteredLoading, CenteredError } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { CONNECTION_TYPE } from '../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import { initConnectionResourceDetails } from '../../utils';
import { Utils } from '@/utils/utils';
import { connectionsAPI } from '@/project/api';

import './index.css';

const ConnectionResourceDetails = ({ resource, projectUuid, updateDetails }) => {
  const [status, setStatus] = useState('loading'); // loading / error / loaded
  const [errorMessage, setErrorMessage] = useState('');
  const [details, setDetails] = useState(null);

  const type = useMemo(() => resource.type, [resource]);

  useEffect(() => {
    setStatus('loading');
    connectionsAPI.getConnectionRowDetail(projectUuid, resource.connection_id, { _pk: resource._id }).then((res) => {
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
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
    }
    if (type === CONNECTION_TYPE.EMAIL) {
      return (
        <EmailDetails
          className={`sea-ticket-connection-resource-details sea-ticket-connection-${type}-resource-details pt-4 pb-4`}
          details={details}
          projectUuid={projectUuid}
          connection_id={resource.connection_id}
        />
      );
    }
    return (
      <div className={`sea-ticket-connection-resource-details sea-ticket-connection-${type}-resource-details`}>
        {details.map((detail, index) => {
          return (
            <CommonDetailItem detail={detail} type={type} key={index} />
          );
        })}
      </div>
    );
  }

  if (details) {
    return (<CustomizeMarkdownViewer className={`sea-ticket-connection-${type}-resource-details`} value={details} showTOC={false} />);
  }
  return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No content')} />);
};

export default ConnectionResourceDetails;
