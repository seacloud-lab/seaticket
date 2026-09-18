import React, { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import PropTypes from 'prop-types';
import { DatePicker, CustomizeLabel } from '@/components';
import { gettext } from '@/constants';

import './index.css';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

const DueDateSettings = ({ isReadonly, value: propsValue, onChange }) => {
  const [value, setValue] = useState(propsValue || '');
  const formatValue = useMemo(() => value ? dayjs(value) : null, [value]);

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

  return (
    <div className='seaqa-settings-item mb-4'>
      <CustomizeLabel icon="date">
        {gettext('Due date')}
      </CustomizeLabel>
      <div className="ticket-due-date-formatter">
        <DatePicker
          disabled={isReadonly}
          value={formatValue}
          onChange={onDueDateChange}
          onOpenChange={onOpenChange}
          className="ticket-due-date-content"
        >
          {({ value }) => {
            return (
              <>
                {!value && (
                  <div className="seaqa-tip-default">{gettext('No due date')}</div>
                )}
                {value && (
                  <div className="w-100 h-100 ticket-due-date-value">
                    {dayjs(value).format('YYYY-MM-DD')}
                  </div>
                )}
              </>
            );
          }}
        </DatePicker>
      </div>
    </div>
  );
};

DueDateSettings.propTypes = {
  isReadonly: PropTypes.bool.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default DueDateSettings;
