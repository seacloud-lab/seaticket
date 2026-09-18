import React, { useCallback, useMemo, useRef } from 'react';
import Calendar from '@seafile/seafile-calendar';
import Picker from '@seafile/seafile-calendar/lib/Picker';
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
  isRemainOpen = true,
  format = 'YYYY-MM-DD',
  lang = '',
  value,
  inputWidth = 250,
  className,
  calendarContainer,
  calendarProps,
  children,
  onChange,
  onOpenChange,
  onInputClick,
  ...props
}) => {
  const calendarContainerRef = useRef(null);

  const defaultValue = useMemo(() => {
    let now = dayjs();
    const validLang = lang || window?.app?.config?.lang;
    const isZhcn = validLang === 'zh-cn';
    if (isZhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    return now.clone();
  }, [lang]);

  const showHourAndMinute = useMemo(() => {
    const timeFormat = format.split(' ')[1] || '';
    return Boolean(timeFormat);
  }, [format]);

  const locale = useMemo(() => translateCalendar(), []);

  const initCalendarProps = useMemo(() => {
    return {
      defaultValue,
      disabledDate,
      format,
      locale,
      showHourAndMinute,
      ...calendarProps,
    };
  }, [defaultValue, disabledDate, format, locale, showHourAndMinute, calendarProps]);

  const getCalendarContainer = useCallback(() => {
    return calendarContainer || calendarContainerRef.current;
  }, [calendarContainer]);

  const onMouseDown = useCallback((event) => {
    event.preventDefault();
  }, []);

  return (
    <Picker
      disabled={disabled}
      getCalendarContainer={getCalendarContainer}
      isRemainOpen={isRemainOpen}
      calendar={<Calendar { ...initCalendarProps }/>}
      value={value}
      onChange={onChange}
      onOpenChange={onOpenChange}
      { ...props }
    >
      {({ value, ...others }) => {
        const displayValue = (value && value.format(format)) || '';
        return (
          <div className={className} tabIndex="0" onFocus={onInputClick}>
            {isFunction(children) ? children({ value, onMouseDown, ...others }) : (
              <input
                placeholder={format}
                style={{ width: inputWidth }}
                tabIndex="-1"
                disabled={disabled}
                readOnly={true}
                value={displayValue}
                className="form-control"
                onMouseDown={onMouseDown}
              />
            )}
            <div ref={calendarContainerRef} />
          </div>
        );
      }}
    </Picker>
  );

};

DatePicker.propTypes = {
  disabled: PropTypes.bool,
  disabledDate: PropTypes.func,
  isRemainOpen: PropTypes.bool,
  format: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  value: PropTypes.object,
  inputWidth: PropTypes.number,
  className: PropTypes.string,
  calendarContainer: PropTypes.any,
  children: PropTypes.func,
  onChange: PropTypes.func,
  onOpenChange: PropTypes.func,
  onInputClick: PropTypes.func,
  calendarProps: PropTypes.object,
};

export default DatePicker;
