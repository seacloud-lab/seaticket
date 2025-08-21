import classnames from 'classnames';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPES, CONNECTION_TYPE } from '../../constants';

import './index.css';

const ConnectionNameFormatter = ({ value, row = {}, expandRow }) => {
  const connectionType = row['type'];
  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);

  return (
    <div
      className={classnames('sea-qa-connection-name-formatter', { 'click-able': expandRow && connectionType === CONNECTION_TYPE.GITHUB_ISSUE })}
      onClick={() => expandRow && expandRow(row)}
    >
      <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="connection-icon" />
      <span className="connection-name">{value}</span>
    </div>
  );
};

export default ConnectionNameFormatter;

