import URLFormatter from './url-formatter';
import LongTextFormatter from './long-text-formatter';
import ConnectionNameFormatter from '../connection-name-formatter';
import OpFormatter from './op-formatter';
import TextFormatter from './text-formatter';
import { CONNECTION_FIELD_TYPE } from '../../constants';
import Selector from './active-status-fomatter/single-selector';

const createFormatter = (type) => {
  console.log(type)
  if (type === CONNECTION_FIELD_TYPE.URL) return (<URLFormatter />);
  if (type === CONNECTION_FIELD_TYPE.LONG_TEXT) return (<LongTextFormatter />);
  if (type === CONNECTION_FIELD_TYPE.CONNECTION_NAME) return (<ConnectionNameFormatter />);
  if (type === CONNECTION_FIELD_TYPE.OP) return (<OpFormatter />);
  if (type === CONNECTION_FIELD_TYPE.EMPTY) return null;
  if (type === CONNECTION_FIELD_TYPE.IS_ACTIVE) return (<Selector />)
    
  return (<TextFormatter />);
};

export default createFormatter;
