import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import { DatePicker } from 'antd-mobile';
import Calendar from '@seafile/seafile-calendar';
import * as SeaDatePicker from '@seafile/seafile-calendar/lib/Picker';
import { gettext } from '../../utils/constants';
import * as zIndexes from '../utils/zIndexes';
import { translateCalendar, minDate, maxDate } from '../utils/date-format-utils';
import MobileCommonHeader from './mobile-common-header';
import { getFirstDayOfWeek } from '../../utils/utils';

import '@seafile/seafile-calendar/assets/index.css';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en-gb';

const propTypes = {
  dateFormat: PropTypes.string,
  column: PropTypes.object,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onCommit: PropTypes.func,
  onChange: PropTypes.func,
  closeEditor: PropTypes.func,
};


let now = dayjs();

class DateEditorView extends React.PureComponent {

  constructor(props) {
    super(props);
    this.showTime = props.column.data ? props.column.data.format.indexOf('HH:mm') > -1 : false;
    this.state = {
      time: null,
      defaultCalendarValue: null,
    };
    this.calendarContainerRef = React.createRef();
    this.locale = this.getMobileDatePickerLocale();
  }

  componentDidMount() {
    history.pushState(null, null, '#');
    window.addEventListener('popstate', this.handleHistoryBack, false);
    let { value } = this.props;
    let newValue;
    const iszhcn = (window.app.config && window.app.config.lang === 'zh-cn');
    if (iszhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    if (value) {
      newValue = dayjs(value);
    } else {
      newValue = dayjs(new Date());
    }
    this.setState({
      defaultCalendarValue: now.clone(),
      time: iszhcn ? dayjs(newValue).locale('zh-cn') : dayjs(newValue).locale('en-gb')
    }, () => {
      this.props.onChange(this.state.time);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handleHistoryBack, false);
  }

  handleHistoryBack = (e) => {
    e.preventDefault();
    this.props.closeEditor();
  };

  getMobileDatePickerLocale = () => {
    return {
      DatePickerLocale: {
        year: gettext('Year'),
        month: gettext('Month'),
        day: gettext('Day'),
        hour: gettext('Hour'),
        minute: gettext('Minute'),
      },
      okText: gettext('Done'),
      dismissText: gettext('Cancel')
    };
  };

  handleDateChange = (date) => {
    if (this.showTime) {
      const HM = dayjs(this.state.time).format('HH:mm');
      // In iOS, the time standard is ISO-8601, new Date("YYYY-MM-DD") will be wrong, new Date("YYYY/MM/DD") will be OK.
      const newTime = dayjs(date).format('YYYY/MM/DD') + ' ' + HM;
      this.setState({ time: new Date(newTime) });
    }
    else {
      this.setState({ time: date });
    }
    this.props.onChange(dayjs(date));
  };

  handleTimeChange = (time) => {
    // In iOS, the time standard is ISO-8601, new Date("YYYY-MM-DD") will be wrong, new Date("YYYY/MM/DD") will be OK.
    const YMD = dayjs(this.state.time).format('YYYY/MM/DD');
    const newTime = YMD + ' ' + dayjs(time).format('HH:mm');
    this.setState({ time: new Date(newTime) });
    this.props.onChange(dayjs(new Date(newTime)));
  };

  closeEditor = () => {
    this.props.closeEditor();
  };

  deleteDate = () => {
    this.props.onChange(null);
    this.props.closeEditor();
  };

  getCalendarContainer = () => {
    return this.calendarContainerRef.current;
  };

  getFormat = () => {
    return this.showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  };

  onChange = (value) => {
    if (!value) return;
    const newTime = value.format(this.getFormat());
    this.setState({ time: newTime });
    this.props.onChange(value);
  };

  renderCalendar() {
    const { time } = this.state;
    const firstDayOfWeek = getFirstDayOfWeek();
    const calendar = (
      <Calendar
        className="date-editor-rc-calendar"
        locale={translateCalendar()}
        dateInputPlaceholder={gettext('Please input date')}
        format={this.getFormat()}
        defaultValue={this.state.defaultCalendarValue}
        showDateInput={false}
        focusablePanel={false}
        showToday={false}
        showTime={false}
        style={{ width: '100%', fontSize: '14px' }}
        firstDayOfWeek={firstDayOfWeek}
      />
    );
    return (
      <div className="date-picker-container">
        <SeaDatePicker
          calendar={calendar}
          value={dayjs(time)}
          onChange={this.onChange}
          getCalendarContainer={this.getCalendarContainer}
          open={true}
          style={{ width: '100%' }}
        >
          {({ time }) => {
            return (
              <div tabIndex="0" onFocus={this.onReadOnlyFocus}>
                <input
                  placeholder={gettext('Please select')}
                  readOnly
                  tabIndex="-1"
                  className="ant-calendar-picker-input ant-input form-control"
                  value={time ? dayjs(time).format(this.getFormat()) : ''}
                />
                <div ref={this.calendarContainerRef} style={{ height: '22rem' }}/>
              </div>
            );
          }}
        </SeaDatePicker>
      </div>
    );
  }

  render() {
    const { column, dateFormat } = this.props;
    const rightFormat = 'HH:mm';
    return (
      <div className="row-expand-view date-editor-view" style={{ zIndex: zIndexes.ROW_EXPAND_VIEW }}>
        <MobileCommonHeader
          title={column.name}
          onLeftClick={this.closeEditor}
          onRightClick={this.closeEditor}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
        />
        <div className="date-input" style={this.showTime ? { width: '50%' } : { width: '100%' }}>
          <DatePicker
            locale={this.locale}
            mode="date"
            value={this.state.value}
            minDate={minDate}
            maxDate={maxDate}
            onChange={this.handleDateChange}
          >
            <div className="date-input-day">{dayjs(this.state.time).format(dateFormat)}</div>
          </DatePicker>
        </div>
        {this.showTime &&
          <div className="date-input" style={{ width: '50%' }}>
            <DatePicker locale={this.locale} mode="time" value={this.state.value} onChange={this.handleTimeChange}>
              <div className="date-input-day">{dayjs(this.state.time).format(rightFormat)}</div>
            </DatePicker>
          </div>
        }
        <div className="view-partition view-partition-border-top view-partition-border-bottom"></div>
        {this.renderCalendar()}
        <div className="row-expand-view-footer">
          <div onClick={this.deleteDate} className="clear-date">{gettext('Clear')}</div>
        </div>
      </div>
    );
  }
}

DateEditorView.propTypes = propTypes;

export default DateEditorView;
