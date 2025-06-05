import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import Calendar from '@seafile/seafile-calendar';
import DatePicker from '@seafile/seafile-calendar/lib/Picker';
import { translateCalendar } from '../../../components-form/utils/date-format-utils';
import { getFirstDayOfWeek } from '../../../utils/utils';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en-gb';

import '@seafile/seafile-calendar/assets/index.css';

let now = dayjs();

const propTypes = {
  disabledDate: PropTypes.func.isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

const FORMAT = 'YYYY-MM-DD';

class Picker extends React.Component {

  constructor(props) {
    super(props);
    this.defaultCalendarValue = null;
  }

  componentDidMount() {
    const iszhcn = (window.app.config && window.app.config.lang === 'zh-cn');
    if (iszhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    this.defaultCalendarValue = now.clone();
  }

  render() {
    const props = this.props;
    const firstDayOfWeek = getFirstDayOfWeek();
    const calendar = (<Calendar
      defaultValue={this.defaultCalendarValue}
      disabledDate={props.disabledDate}
      format={FORMAT}
      locale={translateCalendar()}
      className="statistic-calendar"
      firstDayOfWeek={firstDayOfWeek}
    />);
    return (
      <DatePicker
        calendar={calendar}
        value={props.value}
        onChange={props.onChange}
      >
        {
          ({ value }) => {
            return (
              <span>
                <input
                  placeholder="yyyy-mm-dd"
                  tabIndex="-1"
                  readOnly
                  value={(value && value.format(FORMAT)) || ''}
                  className="form-control system-statistic-input"
                />
              </span>
            );
          }
        }
      </DatePicker>
    );
  }
}

Picker.propTypes = propTypes;

export default Picker;
