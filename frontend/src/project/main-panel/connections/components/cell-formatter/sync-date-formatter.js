import React, { useMemo } from 'react';
import DateFormatter from './date-formatter';
import { isConnectionSyncCompleted } from '../../utils';

const SyncDateFormatter = ({ value, column, row, className }) => {
  const validValue = useMemo(() => {
    if (isConnectionSyncCompleted(row)) return value;
    return null;
  }, [value, row]);

  return (<DateFormatter value={validValue} column={column} className={className} />);
};

export default SyncDateFormatter;
