import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Icon } from '@/components';
import { PRIORITY_MAP } from '../../../constants';
import { gettext } from '@/constants';

const PriorityItem = ({ value, readOnly, onClick, isSelected, hotKey }) => {
  const priority = PRIORITY_MAP[value];
  if (!priority) return null;
  if (readOnly) {
    return (
      <div className={classnames('sea-metadata-priority-item sea-metadata-priority-item-readonly')}>
        <Icon className="sea-metadata-icon" symbol={priority.icon} title={priority.name}/>
      </div>
    );
  }
  return (
    <div className={classnames('sea-metadata-priority-item')} onClick={() => onClick(value)}>
      <span className={classnames('sea-metadata-priority-item-left')}>
        {priority.icon ?
          <Icon className="sea-metadata-icon" symbol={priority.icon} title={priority.name}/>
          :
          <span className="px-2"></span>
        }
        <span className="ml-2">{priority.name}</span>
      </span>
      <span className={classnames('sea-metadata-priority-item-right')}>
        {isSelected && <Icon className="sea-metadata-icon" symbol="check" title={gettext('Selected')}/>}
        <span className="ml-2">{hotKey}</span>
      </span>
    </div>
  );
};

PriorityItem.propTypes = {
  readOnly: PropTypes.bool,
  onClick: PropTypes.func,
};

export default PriorityItem;
