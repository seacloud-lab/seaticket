import classnames from 'classnames';
import { mediaUrl } from '@/constants';
import { CONNECTION_TYPES, SUPPORT_DETAILS_CONNECTION_TYPES } from '../../constants';

import './index.css';

const ConnectionNameFormatter = ({ value, row = {}, expandRow }) => {
  const connectionType = row['type'];
  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);
  const enableClick = expandRow && SUPPORT_DETAILS_CONNECTION_TYPES.includes(connectionType);

  return (
    <div
      className={classnames('sea-qa-connection-name-formatter', { 'click-able': enableClick })}
      onClick={enableClick ? () => expandRow(row) : () => {}}
    >
      <img src={`${mediaUrl}img/connection/${connectionOption.icon}.png`} alt={connectionOption.name} className="connection-icon" />
      <span className="connection-name">{value}</span>
    </div>
  );
};

export default ConnectionNameFormatter;

