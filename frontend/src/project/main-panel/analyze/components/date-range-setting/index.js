import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import Picker from '@/project/main-panel/search/date-and-time-picker';

const DATE_INPUT_WIDTH = 120;
const DateRangeSetting = ({ startDate, endDate, onChange, }) => {
  const isValidStart = dayjs(startDate, 'YYYY-MM-DD', true).isValid();
  const isValidEnd = dayjs(endDate, 'YYYY-MM-DD', true).isValid();
  const [time, setTime] = useState({
    from: isValidStart ? dayjs(startDate) : null,
    to: isValidEnd ? dayjs(endDate) : null,
  });

  const disabledStartDate = useCallback((startDate) => {
    if (!startDate) return false;
    const endValue = time.to;
    if (!endValue) return false;
    return endValue.isBefore(startDate);
  }, [time]);

  const disabledEndDate = useCallback((endDate) => {
    if (!endDate) return false;
    const startValue = time.from;
    if (!startValue) return false;
    return endDate.isBefore(startValue);
  }, [time]);

  return (
    <div className="date-range-setting-wrapper d-flex justify-content-between align-items-center">
      <Picker
        showHourAndMinute={false}
        disabledDate={disabledStartDate}
        value={time.from}
        onChange={(value) => {
          const newTime = { ...time, from: value?.endOf('day') };
          onChange(newTime);
          setTime(newTime);
        }}
        inputWidth={DATE_INPUT_WIDTH}
      />
      <span>--</span>
      <Picker
        showHourAndMinute={false}
        disabledDate={disabledEndDate}
        value={time.to}
        onChange={(value) => {
          const newTime = { ...time, to: value?.endOf('day') };
          onChange(newTime);
          setTime(newTime);
        }}
        inputWidth={DATE_INPUT_WIDTH}
      />
    </div>
  );
};

DateRangeSetting.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

export default DateRangeSetting;
