import React, { useCallback, useMemo, useRef } from 'react';
import Calendar from '@seafile/seafile-calendar';
import DatePickerComponent from '@seafile/seafile-calendar/lib/Picker';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import PropTypes from 'prop-types';
import { isFunction } from '@/utils/type-detection';
import { translateCalendar } from './utils';

import '@seafile/seafile-calendar/assets/index.css';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

const DatePicker = ({
  disabled,
  disabledDate,
  format = 'YYYY-MM-DD',
  value,
  inputWidth = 250,
  className,
  children,
  onChange,
  onOpenChange,
  onFocus,
  calendarProps,
  ...props
}) => {
  const calendarContainerRef = useRef(null);
  const inputRef = useRef(null);

  const defaultCalendarValue = useMemo(() => {
    let now = dayjs();
    let lang = window?.app?.config?.lang;
    const isZhcn = lang === 'zh-cn';
    if (isZhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    return now.clone();
  }, []);

  const showHourAndMinute = useMemo(() => {
    if (Array.isArray(format)) return format.some(item => Boolean(item.split(' ')[1] || ''));
    const timeFormat = format.split(' ')[1] || '';
    return Boolean(timeFormat);
  }, [format]);

  const locale = useMemo(() => translateCalendar(), []);

  const getCalendarContainer = useCallback(() => {
    return calendarContainerRef.current;
  }, []);

  const onMouseDown = useCallback((event) => {
    event.preventDefault();
  }, []);

  return (
    <DatePickerComponent
      disabled={disabled}
      getCalendarContainer={getCalendarContainer}
      isRemainOpen={true}
      calendar={
        <Calendar
          defaultValue={defaultCalendarValue}
          disabledDate={disabledDate}
          format={format}
          locale={locale}
          showHourAndMinute={showHourAndMinute}
          { ...calendarProps }
        />
      }
      value={value}
      onChange={onChange}
      onOpenChange={onOpenChange}
      { ...props }
    >
      {({ value, ...others }) => {
        return (
          <div className={className} tabIndex="0" onFocus={onFocus}>
            {isFunction(children) ? children({ value, onMouseDown, ...others }) : (
              <input
                placeholder={format}
                style={{ width: inputWidth }}
                tabIndex="-1"
                disabled={disabled}
                readOnly={true}
                value={(value && value.format(format)) || ''}
                className="form-control"
                ref={inputRef}
                onMouseDown={onMouseDown}
              />
            )}
            <div ref={calendarContainerRef} />
          </div>
        );
      }}
    </DatePickerComponent>
  );

};

DatePicker.propTypes = {
  showHourAndMinute: PropTypes.bool.isRequired,
  disabledDate: PropTypes.func.isRequired,
  value: PropTypes.object,
  disabled: PropTypes.func,
  inputWidth: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired
};

export default DatePicker;
