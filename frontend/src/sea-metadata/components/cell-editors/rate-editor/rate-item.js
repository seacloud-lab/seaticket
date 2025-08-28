import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';
import classnames from 'classnames';
import Icon from '../../../../components/icon';
import { DEFAULT_RATE_DATA } from '../../../constants';

const RateItem = ({
  isShowRateItem,
  column,
  enterIndex,
  index,
  value,
  onMouseEnter: onMouseEnterAPI,
  onMouseLeave: onMouseLeaveAPI,
  onChange: onChangeAPI,
}) => {
  const ref = useRef(null);

  const onMouseEnter = useCallback(() => {
    onMouseEnterAPI(index);
  }, [index, onMouseEnterAPI]);

  const onMouseLeave = useCallback(() => {
    onMouseLeaveAPI();
  }, [onMouseLeaveAPI]);

  const onChange = useCallback(() => {
    onChangeAPI(index);
  }, [index, onChangeAPI]);

  if (!isShowRateItem && index > value) return null;

  const { color, type } = column.data || DEFAULT_RATE_DATA;
  let style = { fill: value >= index ? color : '#eee' };

  if (enterIndex >= index) {
    style = {
      color: color,
      opacity: value >= index ? 1 : 0.4
    };
  }

  return (
    <>
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onChange}
        className={classnames('sea-metadata-rate-item', { 'active': value >= index })}
        ref={ref}
      >
        <Icon className="sea-metadata-icon" symbol={type || 'rate'} style={style} />
      </div>
      {enterIndex !== -1 && (
        <UncontrolledTooltip placement='bottom' target={ref} modifiers={[{ name: 'preventOverflow', options: { boundary: document.body } }]} className="sea-metadata-tooltip">
          {enterIndex}
        </UncontrolledTooltip>
      )}
    </>
  );

};

RateItem.propTypes = {
  isShowRateItem: PropTypes.bool,
  column: PropTypes.object,
  enterIndex: PropTypes.number,
  index: PropTypes.number,
  value: PropTypes.number,
  onMouseEnter: PropTypes.func,
  onMouseLeave: PropTypes.func,
  onChange: PropTypes.func,
};

export default RateItem;
