import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import Icon from '../../../../components/icon';
import { RATE_MAP } from './constants';
import { gettext } from '@/constants';

const RateItem = ({ value, readOnly, onClick, isSelected, hotKey }) => {
  const rateItem = RATE_MAP[value];
  if (!rateItem) return null;
  if (readOnly) {
    return (
      <div className={classnames('sea-metadata-rate-item sea-metadata-rate-item-readonly')}>
        <Icon className="sea-metadata-icon" symbol={rateItem.icon} title={rateItem.name}/>
      </div>
    );
  }
  return (
    <div className={classnames('sea-metadata-rate-item')} onClick={() => onClick(value)}>
      <span className={classnames('sea-metadata-rate-item-left')}>
        {rateItem.icon ?
          <Icon className="sea-metadata-icon" symbol={rateItem.icon} title={rateItem.name}/>
          :
          <span className="px-2"></span>
        }
        <span className="ml-2">{rateItem.name}</span>
      </span>
      <span className={classnames('sea-metadata-rate-item-right')}>
        {isSelected && <Icon className="sea-metadata-icon" symbol="check" title={gettext('Selected')}/>}
        <span className="ml-2">{hotKey}</span>
      </span>
    </div>
  );
};

RateItem.propTypes = {
  readOnly: PropTypes.bool,
  onClick: PropTypes.func,
};

export default RateItem;
