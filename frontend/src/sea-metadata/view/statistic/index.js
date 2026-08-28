import React from 'react';
import { useMetadata } from '@/sea-metadata/hooks';
import { EmptyTip } from '@/components';
import { gettext, mediaUrl } from '@/constants';
import Card from './card';

import './index.css';

const Statistic = () => {
  const { metadata } = useMetadata();
  const { rows } = metadata;

  if (rows.length === 0) {
    return (<EmptyTip className="w-100" src={`${mediaUrl}img/no-items-tip.png`} text={gettext('No statistics')} />);
  }

  return (
    <div className="sea-metadata-statistics-view">
      {rows.map(row => {
        if (row.type === 'card') return (<Card statistic={row} key={row._id} />);
        return null;
      })}
    </div>
  );
};

export default Statistic;
