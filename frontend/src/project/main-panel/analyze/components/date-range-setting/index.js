import React, { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import DateAndTimePicker from '@/project/main-panel/search/date-and-time-picker';

const DATE_INPUT_WIDTH = 120;
const DateRangeSetting = ({ startDate, endDate, onChange, }) => {
  const fromValue = useMemo(() => {
    return dayjs(startDate, 'YYYY-MM-DD', true).isValid() ? dayjs(startDate) : null;
  }, [startDate]);

  const toValue = useMemo(() => {
    return dayjs(endDate, 'YYYY-MM-DD', true).isValid() ? dayjs(endDate) : null;
  }, [endDate]);

  const disabledStartDate = useCallback((date) => {
    if (!date || !toValue) return false;
    return toValue.isBefore(date);
  }, [toValue]);

  const disabledEndDate = useCallback((date) => {
    if (!date || !fromValue) return false;
    return date.isBefore(fromValue);
  }, [fromValue]);

  return (
    <div className="date-range-setting-wrapper d-flex justify-content-between align-items-center">
      <DateAndTimePicker
        showHourAndMinute={false}
        disabledDate={disabledStartDate}
        value={fromValue}
        onChange={(value) => {
          onChange({ from: value?.endOf('day'), to: toValue });
        }}
        inputWidth={DATE_INPUT_WIDTH}
      />
      <span>--</span>
      <DateAndTimePicker
        showHourAndMinute={false}
        disabledDate={disabledEndDate}
        value={toValue}
        onChange={(value) => {
          onChange({ from: fromValue, to: value?.endOf('day') });
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
