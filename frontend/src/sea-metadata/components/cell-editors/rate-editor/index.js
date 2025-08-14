import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import RateItem from './rate-item';
import { DEFAULT_RATE_DATA } from '../../../constants';

import './index.css';

const RateEditor = ({ isCellSelected, column, value: oldValue, onChange }) => {
  const [value, setValue] = useState(oldValue || 0);
  const [enterIndex, setEnterIndex] = useState(-1);

  useEffect(() => {
    setValue(oldValue || 0);
  }, [oldValue]);

  const onMouseEnterRateItem = useCallback((index) => {
    setEnterIndex(index);
  }, []);

  const onMouseLeaveRateItem = useCallback(() => {
    setEnterIndex(-1);
  }, []);

  const onChangeValue = useCallback((index) => {
    const newValue = value === index ? 0 : index;
    setValue(newValue);
    onChange({ [column.key]: newValue });
  }, [value, column, onChange]);

  const renderRate = useCallback(() => {
    const { max = 5 } = column.data || DEFAULT_RATE_DATA;
    let rateList = [];
    if (value || isCellSelected) {
      for (let i = 0; i < max; i++) {
        const rateItem = (
          <RateItem
            key={i}
            index={i + 1}
            enterIndex={enterIndex}
            value={value}
            column={column}
            isShowRateItem={isCellSelected}
            onMouseEnter={onMouseEnterRateItem}
            onMouseLeave={onMouseLeaveRateItem}
            onChange={onChangeValue}
          />
        );
        rateList.push(rateItem);
      }
    }
    return rateList;
  }, [column, value, isCellSelected, enterIndex, onChangeValue, onMouseEnterRateItem, onMouseLeaveRateItem]);

  return (
    <div className="sea-metadata-rate-editor d-flex">
      {renderRate()}
    </div>
  );
};

RateEditor.propTypes = {
  isCellSelected: PropTypes.bool,
  column: PropTypes.object,
  value: PropTypes.number,
  onChange: PropTypes.func,
};

export default RateEditor;
