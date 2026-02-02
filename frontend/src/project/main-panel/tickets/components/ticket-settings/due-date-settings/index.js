import React, { useCallback, useMemo, useRef } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import Calendar from '@seafile/seafile-calendar';
import DatePicker from '@seafile/seafile-calendar/lib/Picker';
import { translateCalendar } from '@/utils/date-format-utils';

import '@seafile/seafile-calendar/assets/index.css';
import './index.css';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

const DueDateSettings = ({ isReadonly, value, className = 'mb-4', onChange }) => {
  const calendarContainerRef = useRef(null);
  const formatValue = value ? dayjs(value) : null;

  const onDueDateChange = useCallback((value) => {
    const newValue = value ? dayjs(value).format('YYYY-MM-DD') : '';
    onChange(newValue);
  }, [onChange]);

  const locale = useMemo(() => {
    return translateCalendar();
  }, [translateCalendar]);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <Label>{gettext('Due Date')}</Label>
      <div className="ticket-due-date-formatter">
        <DatePicker
          getCalendarContainer={calendarContainerRef.current}
          calendar={<Calendar format='YYYY-MM-DD' locale={locale}/>}
          disabled={isReadonly}
          value={formatValue}
          onChange={onDueDateChange}
        >
          {
            ({ value }) => {
              return (
                <div>
                  {!formatValue && (
                    <div className="tip-default">{gettext('No due date')}</div>
                  )}
                  {formatValue && (
                    <input
                      placeholder={gettext('No due date')}
                      tabIndex="-1"
                      readOnly={true}
                      value={value ? dayjs(value).format('YYYY-MM-DD') : ''}
                      className="due-date-input-wrapper form-control"
                    />
                  )}
                  <div ref={calendarContainerRef.current}/>
                </div>
              );
            }
          }
        </DatePicker>
      </div>
    </div>
  );
};

export default DueDateSettings;
