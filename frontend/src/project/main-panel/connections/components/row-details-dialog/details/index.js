import React from 'react';
import { EmptyTip, CustomizeMarkdownViewer } from '@/components';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetails from './email-details';
import { generatorConnectionAssetURLPrefix } from '../../../utils';

const Details = ({ details, type, connection, projectUuid }) => {
  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />);
    }
    if (type === CONNECTION_TYPE.EMAIL) {
      const assetURLPrefix = generatorConnectionAssetURLPrefix(projectUuid, connection.id);
      return (
        <EmailDetails className="sea-qa-connection-row-details pt-4 pb-4" details={details} assetURLPrefix={assetURLPrefix}/>
      );
    }
    return (
      <div className="sea-qa-connection-row-details">
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

export default Details;
