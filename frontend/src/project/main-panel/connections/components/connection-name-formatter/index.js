import classnames from 'classnames';
import Icon from '@components/icon';
import { getConnectionIcon } from '../../utils';
import { CONNECTION_TYPES } from '../../constants';
import { isFunction } from '@/utils/type-detection';

import './index.css';

const ConnectionNameFormatter = ({ value, row = {}, expandRow }) => {
  const connectionType = row['type'];
  const connectionOption = CONNECTION_TYPES.find(c => c.type === connectionType);
  const enableClick = isFunction(expandRow);

  return (
    <div
      className={classnames('sea-qa-connection-name-formatter', { 'click-able': enableClick })}
      onClick={enableClick ? () => expandRow(row) : () => {}}
      title={value}
    >
      <img src={getConnectionIcon(connectionType)} alt={connectionOption.name} className="connection-icon" />
      <div className="connection-name-wrapper">
        <span className="connection-name">{value}</span>
        {!row.is_active && <Icon symbol="inactive" className="inactive-icon"/>}
      </div>
    </div>
  );
};

export default ConnectionNameFormatter;

