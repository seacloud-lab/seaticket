import React, { useMemo } from 'react';
import { isConnectionSyncCompleted } from '../../utils';
import DateFormatter from './date-formatter';

const SyncDateFormatter = ({ value, column, row, className }) => {
  const validValue = useMemo(() => {
    if (isConnectionSyncCompleted(row)) return value;
    return null;
  }, [value, row]);

  return (<DateFormatter value={validValue} column={column} className={className} />);
};

export default SyncDateFormatter;
