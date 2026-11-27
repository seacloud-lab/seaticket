import React, { Component } from 'react';
import localeData from 'dayjs/plugin/localeData';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import PropTypes from 'prop-types';
import { DatePicker } from '@/components';
import { getEventClassName } from '@/utils/dom';
import { isFunction } from '@/utils/type-detection';
import { withSeaMetadataContext } from '../../context-provider';
import dayjs from '../../utils/dayjs';

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en-gb';

dayjs.extend(utc);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);

let now = dayjs();

class DateEditor extends Component {

  constructor(props) {
    super(props);
    this.state = {
      value: null,
    };
    const { format = 'YYYY-MM-DD' } = props;
    this.lang = props.metadataContext.getSetting('lang') || 'zh-cn';
    this.calendarClassName = `${props.metadataContext.id}-date-editor-calendar`;
    this.format = format;
    this.calendarContainerRef = React.createRef();
    const isZhcn = this.lang === 'zh-cn';
    if (isZhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    this.defaultCalendarValue = now.clone();
    this.timeFormat = this.format.split(' ')[1] || '';
    this.valueSubmitFormat = 'YYYY-MM-DD';
    if (this.timeFormat) {
      this.valueSubmitFormat = this.valueSubmitFormat + ' ' + this.timeFormat;
    }
  }

  componentDidMount() {
    const { value } = this.props;
    const isZhcn = this.lang === 'zh-cn';
    if (value && dayjs(value).isValid()) {
      if (typeof value === 'string' && value.length === 1 && !isNaN(Number(value, 10))) {
        this.timer = setTimeout(() => {
          const inputDom = document.querySelector(`.${this.calendarClassName} .rc-calendar-input`);
          if (inputDom) {
            inputDom.value = value;
          }
        }, 200);
        return;
      }
      let validValue = dayjs(value).isValid() ? dayjs(value) : dayjs(this.defaultCalendarValue);
      this.setState({ value: isZhcn ? dayjs(validValue).locale('zh-cn') : dayjs(validValue).locale('en-gb') });
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  onChange = (value) => {
    if (!value) return;
    this.setState({ value });
    if (isFunction(this.props.onChange)) {
      this.props.onChange(value.format(this.valueSubmitFormat));
    }
  };

  getValue = () => {
    const { value } = this.state;
    const formattedValue = value ? value.format(this.valueSubmitFormat) : null;
    const columnKey = this.props.column?.key;
    if (columnKey) {
      return { [columnKey]: formattedValue };
    }
    return formattedValue;
  };

  getInputNode = () => {
    if (!this.datePickerRef) return null;
    if (this.datePickerRef.tagName === 'INPUT') {
      return this.datePickerRef;
    }
    return this.datePickerRef.querySelector('input:not([type=hidden])');
  };

  onBlur = (type) => {
    if (this.props.onBlur) this.props.onBlur(type);
  };

  closeEditor = () => {
    this.onBlur();
  };

  handleKeyDown = (e) => {
    const directionKeyCodes = [37, 38, 39, 40];
    if (directionKeyCodes.includes(e.keyCode)) {
      e.stopPropagation();
    } else if (e.keyCode === 13) {
      e.preventDefault();
      this.onBlur('enter');
    }
  };

  onClick = (event) => {
    event.stopPropagation();
    const className = getEventClassName(event);
    if (!this.timeFormat && className === 'rc-calendar-date') {
      this.timer = setTimeout(() => {
        this.closeEditor();
      }, 1);
    }
  };

  onClear = () => {
    if (isFunction(this.props.onClear)) {
      this.props.onClear();
      return;
    }
    this.setState({ value: null });
  };

  onHotKey = (e) => {
    if (!this.props.metadataContext.ownsEvent(e) && !e.target?.closest?.(`.${this.calendarClassName}`)) return;
    if (e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      this.props.onClose && this.props.onClose(true);
    }
  };

  getCalendarContainer = (trigger) => {
    // The portal host owns events without trapping the calendar under the
    // positioned editor's z-index, which is below an enclosing modal.
    return trigger.closest('[data-sea-metadata-instance]') || document.body;
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

  getDefaultMinutesTime = () => {
    const { value } = this.props;
    if (!this.timeFormat) return '';
    if (value) return dayjs(value).format('HH:mm');
    return '';
  };

  onClickRightPanelTime = () => {
    if (this.timeFormat.indexOf('ss') > 0) return;

    setTimeout(() => {
      this.closeEditor();
    }, 1);
  };

  render() {
    const { isReadOnly = false } = this.props;
    const state = this.state;
    if (isReadOnly) return (
      <input
        className="form-control"
        value={state.value ? state.value.format(this.format) : ''}
        disabled={true}
      />
    );
    return (
      <div
        className="date-picker-container"
        ref={ref => this.datePickerRef = ref}
        onKeyDown={(e) => this.handleKeyDown(e)}
        onClick={(e) => this.onClick(e)}
      >
        <DatePicker
          open={true}
          style={{ zIndex: 1060 }}
          format={this.format}
          value={state.value}
          calendarProps={{
            className: this.calendarClassName,
            style: { zIndex: 1060 },
            format: this.getCalendarFormat(),
            showDateInput: true,
            focusablePanel: false,
            defaultMinutesTime: this.getDefaultMinutesTime(),
            onClear: this.onClear,
            onClickRightPanelTime: this.onClickRightPanelTime
          }}
          getCalendarContainer={this.getCalendarContainer}
          onChange={this.onChange}
          onOpenChange={this.onOpenChange}
        />
      </div>
    );
  }
}

DateEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  format: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
};

export default withSeaMetadataContext(DateEditor);
