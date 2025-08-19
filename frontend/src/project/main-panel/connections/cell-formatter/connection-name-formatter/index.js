import { mediaUrl } from '../../../../../constants';
import { CONNECTION_TYPES } from '../../../../constants';

import './index.css';

const ConnectionNameFormatter = ({ value, row = {}, onClick }) => {
  const connectionType = row['type'];
  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);
  const handleClick = () => {
    if (onClick) {
      onClick(row);
    }
  };

  return (
    <div
      className="sea-qa-connection-name-formatter"
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <img
        src={`${mediaUrl}img/connection/${connectionOption.icon}.png`}
        alt={connectionOption.name}
        className="connection-icon"
      />
      <span className="connection-name">{value}</span>
    </div>
  );
};

export default ConnectionNameFormatter;

