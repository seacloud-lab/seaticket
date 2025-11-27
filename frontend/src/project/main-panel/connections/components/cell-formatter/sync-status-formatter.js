import PropTypes from 'prop-types';
import { CONNECTION_SYNC_STATUS_NAME } from '../../constants';

const SyncStatusFormatter = ({ row }) => {
  const syncStatus = row?.status?.last_sync_status || '';

  if (!syncStatus) return '--';
  const validSyncStatus = syncStatus.toLowerCase();
  const syncStatusName = CONNECTION_SYNC_STATUS_NAME[validSyncStatus] || syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1);
  return (<span title={syncStatusName}>{syncStatusName}</span>);
};

SyncStatusFormatter.propTypes = {
  row: PropTypes.object,
};

export default SyncStatusFormatter;
