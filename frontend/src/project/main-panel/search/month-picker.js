import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import MonthCalendar from '@seafile/seafile-calendar/lib/MonthCalendar';
import DatePicker from '@seafile/seafile-calendar/lib/Picker';
import { translateCalendar } from '@/utils/date-format-utils';

import '@seafile/seafile-calendar/assets/index.css';
import './date-and-time-picker.css';

dayjs.extend(utc);
dayjs.extend(localeData);

class MonthPicker extends React.Component {

  constructor(props) {
    super(props);
    this.calendarContainerRef = React.createRef();
    this.inputRef = React.createRef();
    let now = dayjs();
    let lang = window.app.config.lang;
    const isZhcn = lang === 'zh-cn';
    if (isZhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    this.defaultCalendarValue = now.clone();
  }

  getCalendarContainer = () => {
    return this.calendarContainerRef.current;
  };

  render() {
    const format = 'YYYY-MM';

    return (
      <DatePicker
        disabled={this.props.disabled}
        getCalendarContainer={this.getCalendarContainer}
        calendar={
          <MonthCalendar
            defaultValue={this.defaultCalendarValue}
            disabledDate={this.props.disabledDate}
            format={format}
            locale={translateCalendar()}
            showHourAndMinute={false}
            mode="month"
          />
        }
        value={this.props.value}
        onChange={this.props.onChange}
      >
        {
          ({ value }) => {
            return (
              <div>
                <input
                  placeholder={format}
                  style={{ width: this.props.inputWidth || 250 }}
                  tabIndex="-1"
                  disabled={this.props.disabled}
                  readOnly={true}
                  // eslint-disable-next-line
                  value={value && value.format(format) || ''}
                  className="form-control"
                  ref={this.inputRef}
                />
                <div ref={this.calendarContainerRef} />
              </div>
            );
          }
        }
      </DatePicker>
    );
  }
}

MonthPicker.propTypes = {
  disabledDate: PropTypes.func.isRequired,
  value: PropTypes.object,
  disabled: PropTypes.func,
  inputWidth: PropTypes.number,
  onChange: PropTypes.func.isRequired
};

MonthPicker.defaultProps = {
  inputWidth: 200,
  disabled: false
};

export default MonthPicker;
