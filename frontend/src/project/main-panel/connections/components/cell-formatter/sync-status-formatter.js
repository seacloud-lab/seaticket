import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

const MAX_COUNT = 200; // 10 min

const formatStatus = (status) => {
  if (!status) return '--';

  const statusMap = {
    'completed': gettext('Completed'),
    'failed': gettext('Failed'),
    'crawling': gettext('Crawling'),
    'pending': gettext('Pending')
  };

  const normalized = status.toLowerCase();
  return statusMap[normalized] || status.charAt(0).toUpperCase() + status.slice(1);
};

const SyncStatusFormatter = ({ row, getRowStatus, modifyLocalRow }) => {
  const [syncStatus, setSyncStatus] = useState(row?.status?.last_sync_status || '');

  const timerRef = useRef(null);
  const queryCountRef = useRef(0);

  useEffect(() => {
    if (syncStatus !== row?.status?.last_sync_status) {
      setSyncStatus(row?.status?.last_sync_status);
    }
  }, [row?.status?.last_sync_status, syncStatus]);

  useEffect(() => {
    if (syncStatus === 'completed' || syncStatus === 'failed') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setInterval(() => {
      if ((queryCountRef.current + 1) > MAX_COUNT) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        return;
      }
      getRowStatus(row.id).then(status => {
        queryCountRef.current = queryCountRef.current + 1;
        if (status.last_sync_status !== syncStatus) {
          modifyLocalRow(row.id, { status });
        }
      });
    }, 3000);
  }, [syncStatus, row.id, modifyLocalRow]);

  useEffect(() => {
    if (!timerRef.current) return;
    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  return formatStatus(syncStatus);
};

SyncStatusFormatter.propTypes = {
  row: PropTypes.object,
};

export default SyncStatusFormatter;
