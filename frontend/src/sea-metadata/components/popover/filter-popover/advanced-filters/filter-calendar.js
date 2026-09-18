import React, { Component } from 'react';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import PropTypes from 'prop-types';
import { DatePicker } from '@/components';
import { gettext } from '@/constants';
import context from '../../../../context';
import { getDateColumnFormat } from '../../../../utils/column';
import dayjs from '../../../../utils/dayjs';

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en-gb';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

let now = dayjs();

class FilterCalendar extends Component {

  constructor(props) {
    super(props);
    this.state = {
      open: false,
      value: null
    };

    // Minutes and seconds are not supported at present
    const columnFormat = getDateColumnFormat(props.filterColumn).trim();
    this.format = columnFormat.split(' ')[0];
    this.calendarContainerRef = React.createRef();
    this.lang = context.getSetting('lang') || 'zh-cn';
    const isZhcn = this.lang === 'zh-cn';
    if (isZhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    this.defaultCalendarValue = now.clone();
  }

  componentDidMount() {
    const { value } = this.props;
    if (value && dayjs(value).isValid()) {
      let validValue = dayjs(value).isValid() ? dayjs(value) : dayjs(this.defaultCalendarValue);
      this.setState({
        value: this.lang === 'zh-cn' ? dayjs(validValue).locale('zh-cn') : dayjs(validValue).locale('en-gb')
      });
    }
  }

  onChange = (value) => {
    const { onChange } = this.props;
    const searchFormat = 'YYYY-MM-DD';
    this.setState({ value }, () => {
      if (this.state.value) {
        onChange(this.state.value.format(searchFormat));
      }
    });
  };

  onClear = () => {
    this.setState({ value: null }, () => {
      this.setState({ open: true });
    });
  };

  onOpenChange = (open) => {
    this.setState({ open });
  };

  onReadOnlyFocus = () => {
    if (!this.state.open && this.state.isMouseDown) {
      this.setState({ isMouseDown: false });
    } else {
      this.setState({ open: true });
    }
  };

  getCalendarFormat = () => {
    if (this.format.indexOf('YYYY-MM-DD') > -1) {
      let newColumnDataFormat = this.format.replace('YYYY-MM-DD', 'YYYY-M-D');
      return [this.format, newColumnDataFormat];
    }
    if (this.format.indexOf('DD/MM/YYYY') > -1) {
      let newColumnDataFormat = this.format.replace('DD/MM/YYYY', 'D/M/YYYY');
      return [this.format, newColumnDataFormat];
    }
    return [this.format];
  };

  render() {
    const { readOnly = false, zIndex = 1061 } = this.props;
    const state = this.state;
    if (readOnly) return (
      <input
        className="form-control"
        value={state.value ? state.value.format(this.format) : ''}
        disabled={true}
      />
    );
    return (
      <div className="date-picker-container">
        <DatePicker
          value={state.value}
          onChange={this.onChange}
          onOpenChange={this.onOpenChange}
          open={state.open}
          style={{ zIndex: zIndex || 1001 }}
          format={this.format}
          calendarProps={{
            style: { zIndex: zIndex || 1001 },
            format: this.getCalendarFormat(),
            dateInputPlaceholder: gettext('Enter date'),
            showDateInput: true,
            focusablePanel: false,
            onClear: this.onClear,
          }}
          onInputClick={this.onReadOnlyFocus}
        />
      </div>
    );
  }
}

FilterCalendar.propTypes = {
  isReadOnly: PropTypes.bool,
  zIndex: PropTypes.number,
  filterColumn: PropTypes.object.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default FilterCalendar;
