import { CONNECTION_TYPES } from '../../../constants';
import { getConnectionIcon } from '../../../utils';

// import './index.css';

const ConnectionNameFormatter = ({ value, row = {} }) => {
  const connectionType = row['type'];
  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);

  return (
    <div className="sea-qa-connection-name-formatter">
      <img src={getConnectionIcon(connectionType)} alt={connectionOption.name} className="connection-icon" />
      <span className="connection-name">{value}</span>
    </div>
  );
};

export default ConnectionNameFormatter;

