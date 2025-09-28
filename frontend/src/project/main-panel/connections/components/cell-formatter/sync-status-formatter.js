import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

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

const SyncStatusFormatter = ({ row }) => {
  const status = JSON.parse(row?.status || '{}');
  const syncStatus = status.last_sync_status || '';
  const displayText = formatStatus(syncStatus);

  return <span>{displayText}</span>;
};

SyncStatusFormatter.propTypes = {
  row: PropTypes.object,
};

export default SyncStatusFormatter;
