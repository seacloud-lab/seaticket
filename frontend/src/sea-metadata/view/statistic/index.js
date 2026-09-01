import React from 'react';
import { EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import { useMetadata } from '@/sea-metadata/hooks';
import Card from './card';
import Line from './line';
import { STATISTIC_TYPE } from '@/sea-metadata/constants';

import './index.css';

const Statistic = () => {
  const { metadata } = useMetadata();
  const { rows } = metadata;

  if (rows.length === 0) {
    return (<EmptyTip className="w-100" src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No statistics')} />);
  }

  return (
    <div className="sea-metadata-statistics-view w-100 h-100 py-4 d-flex flex-wrap">
      {rows.map(row => {
        if (row.type === STATISTIC_TYPE.CARD) return (<Card statistic={row} key={row._id} />);
        if (row.type === STATISTIC_TYPE.LINE) return (<Line statistic={row} key={row._id} />);
        return null;
      })}
    </div>
  );
};

export default Statistic;
