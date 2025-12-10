import React from 'react';
import { EmptyTip, CustomizeMarkdownViewer } from '@/components';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPE } from '../../../constants';
import CommonDetailItem from './common-detail-item';
import EmailDetailItem from './email-detail-item';

const Details = ({ details, type }) => {
  if (Array.isArray(details)) {
    if (details.length === 0) {
      return (<EmptyTip src={`${mediaUrl}img/no-items-tip.png`} />);
    }
    const Detail = type === CONNECTION_TYPE.EMAIL ? EmailDetailItem : CommonDetailItem;
    return (
      <div className="sea-qa-connection-row-details">
        {details.map((detail, index) => {
          return (
            <Detail detail={detail} type={type} key={index} />
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
