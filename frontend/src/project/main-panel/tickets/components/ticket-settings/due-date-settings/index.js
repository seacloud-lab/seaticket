import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import Calendar from '@seafile/seafile-calendar';
import DatePicker from '@seafile/seafile-calendar/lib/Picker';
import { translateCalendar } from '@/utils/date-format-utils';
import { CustomizeLabel } from '@/components';

import '@seafile/seafile-calendar/assets/index.css';
import './index.css';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

const DueDateSettings = ({ isReadonly, value: propsValue, className = 'mb-4', onChange }) => {
  const calendarContainerRef = useRef(null);
  const [value, setValue] = useState(propsValue || null);
  const formatValue = useMemo(() => value ? dayjs(value) : null, [value]);

  const getCalendarContainer = useCallback(() => {
    return calendarContainerRef.current;
  }, []);

  const onDueDateChange = useCallback((value) => {
    const newValue = value ? dayjs(value).format('YYYY-MM-DD') : '';
    setValue(newValue);
  }, []);

  const onOpenChange = useCallback((nextOpen) => {
    if (isReadonly) return;
    if (nextOpen) return;
    if (propsValue === value) return;
    onChange && onChange(value);
  }, [isReadonly, value, propsValue, onChange]);

  const locale = useMemo(() => {
    return translateCalendar();
  }, [translateCalendar]);

  return (
    <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
      <CustomizeLabel icon="date">
        {gettext('Due date')}
      </CustomizeLabel>
      <div className="ticket-due-date-formatter">
        <DatePicker
          getCalendarContainer={getCalendarContainer}
          calendar={<Calendar format='YYYY-MM-DD' locale={locale} className="sea-ticket-calendar"/>}
          disabled={isReadonly}
          value={formatValue}
          onChange={onDueDateChange}
          onOpenChange={onOpenChange}
          // open={open}
          isRemainOpen={true}
        >
          {
            ({ value }) => {
              return (
                <div className="ticket-due-date-content">
                  {!value && (
                    <div className="tip-default">{gettext('No due date')}</div>
                  )}
                  {value && (
                    <div className="w-100 h-100 ticket-due-date-value">
                      {dayjs(value).format('YYYY-MM-DD')}
                    </div>
                  )}
                  <div ref={calendarContainerRef} />
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
