import React from 'react';
import { EmptyTip, CustomizeMarkdownViewer } from '@/components';
import { mediaUrl, server } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetailItem from './email-detail-item';

const Details = ({ details, type, connection, projectUuid }) => {
  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />);
    }
    const Detail = type === CONNECTION_TYPE.EMAIL ? EmailDetailItem : CommonDetailItem;
    const assetURLPrefix = `${server.endsWith('/') ? server : server + '/'}file/project/${projectUuid}/connections/${connection.id}/path/`;
    return (
      <div className="sea-qa-connection-row-details">
        {details.map((detail, index) => {
          return (
            <Detail detail={detail} type={type} key={index} assetURLPrefix={assetURLPrefix} />
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

export default Details;
