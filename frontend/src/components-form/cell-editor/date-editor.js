import React from 'react';
import PropTypes from 'prop-types';
import dayjs from '../../components/common/dayjs';
import Calendar from '@seafile/seafile-calendar';
import DatePicker from '@seafile/seafile-calendar/lib/Picker';
import MediaQuery from 'react-responsive';
import { ClickOutside } from 'dtable-ui-component';
import { gettext } from '../../utils/constants';
import { translateCalendar } from '../utils/date-format-utils';
import DateEditorView from '../cell-viewer-mobile/date-editor-view';
import { getEventClassName } from '../../utils/utils';
import { getFirstDayOfWeek } from '../../utils/utils';

import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en-gb';
import '@seafile/seafile-calendar/assets/index.css';
import '../cell-css/date-editor.css';

let now = dayjs();

export default class DateEditor extends React.Component {

  static propTypes = {
    isReadOnly: PropTypes.bool,
    isSubmitting: PropTypes.bool,
    value: PropTypes.string,
    column: PropTypes.object,
    onCommit: PropTypes.func,
    t: PropTypes.func,
    isEditorShow: PropTypes.bool,
    updateTabIndex: PropTypes.func,
  };

  static defaultProps = {
    isReadOnly: false,
    value: '',
    defaultCalendarValue: null,
  };

  constructor(props) {
    super(props);
    this.state = {
      open: false,
      isDateInit: false,
      isPopoverShow: props.isEditorShow || false,
      newValue: null,
      dateFormat: 'YYYY-MM-DD',
      showHourAndMinute: false,
      defaultCalendarValue: null,
    };
    this.calendarContainerRef = React.createRef();
  }

  componentDidMount() {
    const iszhcn = (window.app.config && window.app.config.lang === 'zh-cn');
    if (iszhcn) {
      now = now.locale('zh-cn');
    } else {
      now = now.locale('en-gb');
    }
    let dateFormat = this.getDateFormat();
    this.setState({
      isDateInit: true,
      newValue: this.getNewValue(this.props.value),
      dateFormat: dateFormat,
      showHourAndMinute: dateFormat.indexOf('HH:mm') > -1,
      defaultCalendarValue: now.clone(),
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      this.setState({ isPopoverShow: nextProps.isEditorShow, open: nextProps.isEditorShow });
    }
    if (nextProps.value !== this.props.value) {
      this.setState({ newValue: this.getNewValue(nextProps.value) });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.isPopoverShow === false && this.state.isPopoverShow === true) {
      setTimeout(() => {
        const rcCalendarInputDom = document.getElementsByClassName('rc-calendar-input')[0];
        if (rcCalendarInputDom) {
          rcCalendarInputDom.focus();
        }
      }, 200);
    }

    if (prevState.isPopoverShow === true && this.state.isPopoverShow === false && this.dateEditor) {
      this.dateEditor.focus();
    }
  }

  onClickOutside = (e) => {
    if (!getEventClassName(e).includes('submit-form') || !this.props.column.is_required) {
      this.closePopover();
    }
  };

  closePopover = () => {
    this.setState({ isPopoverShow: false, open: false });
  };

  getNewValue = (value) => {
    const iszhcn = (window.app.config && window.app.config.lang === 'zh-cn');
    const newValue = value === 'current_date' ? dayjs(new Date()) : value;
    return newValue && (iszhcn ? dayjs(newValue).locale('zh-cn') : dayjs(newValue).locale('en-gb'));
  };

  getDateFormat = () => {
    let { column } = this.props;
    let defaultDateFormat = 'YYYY-MM-DD';
    let dateFormat = column.data && column.data.format;
    // Old Europe format is D/M/YYYY new format is DD/MM/YYYY
    dateFormat = dateFormat.replace(/D\/M\/YYYY/, 'DD/MM/YYYY');
    return dateFormat || defaultDateFormat;
  };

  onCommit = (value) => {
    let updated = {};
    let { column } = this.props;
    updated[column.key] = value;
    this.props.onCommit(updated);
  };

  onDateEditorToggle = (event) => {
    if (this.props.isReadOnly || this.props.isSubmitting) {
      return;
    }
    // prevent DatePicker open when press Tab
    if (event && event.key === 'Tab') {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
      return;
    }

    this.setState({
      isPopoverShow: !this.state.isPopoverShow,
      open: !this.state.open
    }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
  };

  onFocusDatePicker = () => {
    this.setState({ open: true });
  };

  handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      this.setState({ open: true });
    }
  };

  onChange = (value) => {
    let { showHourAndMinute } = this.state;
    this.setState({ newValue: value }, () => {
      let storageFormat = showHourAndMinute ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
      value = value && value.format(storageFormat);
      this.onCommit(value);
    });
  };

  onOpenChange = (open) => {
    if (!this.state.showHourAndMinute) {
      this.setState({
        isPopoverShow: open,
        open: open
      });
    }
  };

  getCalendarContainer = () => {
    return this.calendarContainerRef.current;
  };

  getCalender = () => {
    const firstDayOfWeek = getFirstDayOfWeek();
    return (
      <Calendar
        className="date-editor-rc-calendar"
        locale={translateCalendar()}
        style={{ zIndex: 1001 }}
        format={this.getDateFormat()}
        defaultValue={this.state.defaultCalendarValue}
        showDateInput={true}
        dateInputPlaceholder={gettext('Please input')}
        focusablePanel={false}
        showHourAndMinute={this.state.showHourAndMinute}
        onClear={this.closePopover}
        onClickRightPanelTime={this.onDateEditorToggle}
        firstDayOfWeek={firstDayOfWeek}
      />
    );
  };

  render() {
    const { isReadOnly, column, onCommit } = this.props;
    if (!this.state.isDateInit) {
      return (
        <div className="cell-editor grid-cell-type-date">
          <div className="date-editor-conteinr">
            <div className="control-form"></div>
          </div>
        </div>
      );
    }

    let calendar = this.getCalender();
    let value = this.state.newValue ? this.state.newValue.format(this.getDateFormat()) : '';
    return (
      <ClickOutside
        onClickOutside={this.onClickOutside}
      >
        <div className="cell-editor grid-cell-type-date" >
          {!this.state.isPopoverShow && (
            <div
              className="date-editor-container"
              onClick={this.onDateEditorToggle}
              onKeyDown={this.onDateEditorToggle}
            >
              <div
                className={`form-control ${isReadOnly ? 'readOnly' : ''}` }
                tabIndex={0}
                aria-label={value + ' ' + gettext('Click to edit date')}
                ref={(el) => {this.dateEditor = el;}}
              >{value || ''}
              </div>
            </div>
          )}
          <MediaQuery query="(min-width: 768px)">
            {this.state.isPopoverShow && (
              <DatePicker
                open={this.state.open}
                value={this.state.newValue || null}
                animation="slide-up"
                style={{ zIndex: 1001 }}
                calendar={calendar}
                getCalendarContainer={this.getCalendarContainer}
                onChange={this.onChange}
                onOpenChange={this.onOpenChange}
              >
                {({ value }) => {
                  value = value && (value.format(this.getDateFormat()) || '');
                  return (
                    <span
                      className="date-editor-container"
                      onFocus={this.onFocusDatePicker}
                    >
                      <input
                        placeholder={gettext('Please select')}
                        readOnly
                        className="ant-calendar-picker-input ant-input form-control"
                        value={value || ''}
                      />
                      <div ref={this.calendarContainerRef} />
                    </span>
                  );
                }}
              </DatePicker>
            )}
          </MediaQuery>
          <MediaQuery query="(max-width: 767.8px)">
            {this.state.isPopoverShow &&
            <div className="cell-viewer-mobile-mask">
              <DateEditorView
                column={column}
                dateFormat={this.getDateFormat()}
                value={this.state.newValue}
                onCommit={onCommit}
                closeEditor={this.onDateEditorToggle}
                onChange={this.onChange}
              />
            </div>
            }
          </MediaQuery>
        </div>
      </ClickOutside>
    );
  }
}
