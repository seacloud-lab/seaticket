import URLFormatter from './url-formatter';
import LongTextFormatter from './long-text-formatter';
import ConnectionNameFormatter from './connection-name-formatter';
import { TABLE_COLUMN_TYPE } from '../../../../constants';

const Formatter = ({ type, value, ...props }) => {
  if (type === TABLE_COLUMN_TYPE.URL) return (<URLFormatter value={value} { ...props } />);
  if (type === TABLE_COLUMN_TYPE.LONG_TEXT) return (<LongTextFormatter value={value} { ...props } />);
  if (type === TABLE_COLUMN_TYPE.CONNECTION_NAME) return (<ConnectionNameFormatter value={value} { ...props } />);
  return (<>{value}</>);
};

export default Formatter;
