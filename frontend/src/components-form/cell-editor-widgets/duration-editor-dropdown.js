import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import MediaQuery from 'react-responsive';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { getDurationDisplayString, formatDurationToNumber } from 'dtable-utils';
import AutoFillObserver from '../../utils/auto-fill-observer';

const propTypes = {
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
};

const gettext = window.gettext;
class DurationEditorDropdown extends Component {

  constructor(props) {
    super(props);
    this.historyCommitOptions = this.getHistoryCommitOptions(props.column);
    const { value, column } = props;
    this.state = {
      displayOptions: this.getDisplayOptions(),
      newValue: getDurationDisplayString(value || '', column?.data),
      isEditorShow: props.isEditorShow || false,
      displayOption: '',
    };
    this.focusTriggered = false;
    this.inputRef = null;
    this.timer = null;
    this.autoFillObserver = null;
  }

  componentDidMount() {
    this.autoFillObserver = new AutoFillObserver(this.inputRef, this.onCommit.bind(this));
  }

  componentWillUnmount() {
    if (this.autoFillObserver) this.autoFillObserver.destroy();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.isEditorShow !== this.props.isEditorShow) {
      if (!nextProps.isEditorShow && this.props.isEditorShow) {
        this.onCommit();
      } else {
        this.setState({ isEditorShow: true, displayOptions: this.getDisplayOptions(this.state.newValue) }, () => {
          setTimeout(() => { this.inputRef.focus(); });
        });
      }
    }
  }

  getHistoryCommitOptions = (column) => {
    if (this.props.getHistoryCommitByColumnKey) {
      let historyCommitOptions = this.props.getHistoryCommitByColumnKey(column.key);
      return historyCommitOptions.filter(item => item);
    }
    return [];
  };

  getDisplayOptions = (newValue = '') => {
    let validNewValue = newValue.trim();
    let displayOptions = [];
    this.historyCommitOptions.forEach(option => {
      if (option.indexOf(validNewValue) > -1) {
        displayOptions.push(option);
      }
    });
    return displayOptions;
  };

  onFocus = () => {
    this.focusTriggered = true;
  };

  onChange = (e) => {
    const { column } = this.props;
    this.timer && clearTimeout(this.timer);
    let value = e.target.value.trim().replace(/[^.-\d:：]/g, '');
    if (value === this.state.newValue) return;

    if (this.props.handleInputChange && !this.focusTriggered) {
      // update the cell value of upper-level components in real time
      const durationNumber = formatDurationToNumber(value, column.data);
      const durationDisplayString = getDurationDisplayString(durationNumber, column.data);
      const updated = { [column.key]: durationDisplayString };
      this.props.handleInputChange(updated);
    }

    this.setState({ newValue: value }, () => {
      this.timer = setTimeout(() => {
        this.setState({ displayOptions: this.getDisplayOptions(this.state.newValue) });
      }, 100);
    });
  };

  onSelectOption = (option) => {
    this.setState({ newValue: option, displayOption: '' }, () => {
      setTimeout(() => {
        this.inputRef.focus();
      });
    });
  };

  onCommit = () => {
    let updated = {};
    let { column } = this.props;
    let { newValue } = this.state;
    let durationNumber = formatDurationToNumber(newValue, column.data);
    let durationDisplayString = getDurationDisplayString(durationNumber, column.data);
    updated[column.key] = durationDisplayString;
    this.setState({ isEditorShow: false, newValue: durationDisplayString });
    this.props.onCommit(updated);
  };

  onBlur = () => {
    this.onCommit();
    this.focusTriggered = false;
  };

  setDisplayOption = (option = '') => {
    if (option === this.state.displayOption) return;
    this.setState({ displayOption: option });
  };

  onEditorHandle = () => {
    if (this.props.isSubmitting) return;
    this.setState({ isEditorShow: true, displayOptions: this.getDisplayOptions(this.state.newValue) }, () => {
      if (this.props.updateTabIndex) {
        this.props.updateTabIndex();
      }
    });
  };

  onKeyDown = (e) => {
    let { selectionStart, selectionEnd, value } = e.currentTarget;
    if (isHotkey('enter', e)) {
      e.preventDefault();
      this.inputRef.blur();
    } else if ((e.keyCode === 37 && selectionStart === 0) ||
      (e.keyCode === 39 && selectionEnd === value.length)
    ) {
      e.stopPropagation();
    }
  };

  onPaste = (e) => {
    e.stopPropagation();
  };

  onCut = (e) => {
    e.stopPropagation();
  };

  renderDropdownMenu = () => {
    let { displayOptions } = this.state;
    return displayOptions.map((option, index) => {
      return (
        <DropdownItem
          key={index}
          onMouseDown={() => this.onSelectOption(option)}
          className="text-editor-dropdown-item text-truncate"
          onMouseEnter={() => this.setDisplayOption(option)}
          onMouseLeave={() => this.setDisplayOption()}
        >
          <span className="item-text">{option}</span>
        </DropdownItem>
      );
    });
  };

  render() {
    let { isEditorShow, newValue, displayOptions, displayOption } = this.state;
    let { column } = this.props;
    let data = column.data || {};
    let { duration_format } = data;
    return (
      <Dropdown
        isOpen={isEditorShow}
        toggle={() => { }}
        className="dtable-dropdown-menu text-editor-dropdown"
      >
        <DropdownToggle tag="span" role="button" data-toggle="dropdown" aria-expanded={isEditorShow} className="text-editor-input">
          <input
            type="text"
            name={column.name}
            title={column.name}
            aria-label={column.name + (this.props.isRequired ? ', ' + gettext('Required') : '')}
            placeholder={duration_format}
            value={displayOption || newValue}
            className="form-control text-editor-content"
            onChange={this.onChange}
            onFocus={this.onFocus}
            onBlur={this.onBlur}
            onClick={this.onEditorHandle}
            onKeyDown={this.onKeyDown}
            ref={ref => this.inputRef = ref}
            onPaste={this.onPaste}
            onCut={this.onCut}
            readOnly={this.props.isSubmitting}
          />
        </DropdownToggle>
        {displayOptions.length > 0 && (
          <Fragment>
            <MediaQuery query="(min-width: 768px)">
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu text-editor-dropdown-menu">
                {this.renderDropdownMenu()}
              </DropdownMenu>
            </MediaQuery>
            <MediaQuery query="(max-width: 767.8px)">
              <DropdownMenu className="dtable-dropdown-menu dropdown-menu text-editor-dropdown-menu text-editor-dropdown-menu-mobile">
                {this.renderDropdownMenu()}
              </DropdownMenu>
            </MediaQuery>
          </Fragment>
        )}
      </Dropdown>
    );
  }
}

DurationEditorDropdown.propTypes = propTypes;

DurationEditorDropdown.defaultProps = {
  value: '',
};

export default DurationEditorDropdown;
