import { CONNECTION_FIELD_TYPE } from '../../constants';
import ConnectionNameFormatter from '../connection-name-formatter';
import DateFormatter from './date-formatter';
import LongTextFormatter from './long-text-formatter';
import OpFormatter from './op-formatter';
import SyncDateFormatter from './sync-date-formatter';
import SyncStatusFormatter from './sync-status-formatter';
import TextFormatter from './text-formatter';
import URLFormatter from './url-formatter';

const createFormatter = (column) => {
  const { type } = column;
  if (type === CONNECTION_FIELD_TYPE.URL) return (<URLFormatter />);
  if (type === CONNECTION_FIELD_TYPE.LONG_TEXT) return (<LongTextFormatter />);
  if (type === CONNECTION_FIELD_TYPE.CONNECTION_NAME) return (<ConnectionNameFormatter />);
  if (type === CONNECTION_FIELD_TYPE.OP) return (<OpFormatter />);
  if (type === CONNECTION_FIELD_TYPE.EMPTY) return null;
  if (type === CONNECTION_FIELD_TYPE.SYNC_STATUS) return (<SyncStatusFormatter />);
  if (type === CONNECTION_FIELD_TYPE.DATE) return (<DateFormatter />);
  if (type === CONNECTION_FIELD_TYPE.SYNC_DATE) return (<SyncDateFormatter />);
  return (<TextFormatter />);
};

export default createFormatter;
