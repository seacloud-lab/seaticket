import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import MediaQuery from 'react-responsive';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Alert } from 'reactstrap';
import { isValidEmail } from 'dtable-utils';
import AutoFillObserver from '../../utils/auto-fill-observer';
import { gettext } from '../../utils/constants';

const propTypes = {
  isSubmitting: PropTypes.bool,
  value: PropTypes.string,
  column: PropTypes.object,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
};

class EmailEditorDropdown extends Component {

  constructor(props) {
    super(props);
    this.historyCommitOptions = this.getHistoryCommitOptions(props.column);
    this.state = {
      displayOptions: this.getDisplayOptions(),
      newValue: props.value || '',
      isEditorShow: props.isEditorShow || false,
      displayOption: '',
      errMessage: ''
    };
    this.isInputtingChinese = false;
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

  onCompositionStart = () => {
    this.isInputtingChinese = true;
  };

  onChange = (e) => {
    const { column } = this.props;
    const value = e.target.value;
    if (this.props.handleInputChange) {
      // update the cell value of upper-level components in real time
      const updated = { [column.key]: value };
      this.props.handleInputChange(updated);
    }

    this.timer && clearTimeout(this.timer);
    this.setState({ newValue: value }, () => {
      if (this.isInputtingChinese) return;
      this.timer = setTimeout(() => {
        this.setState({ displayOptions: this.getDisplayOptions(this.state.newValue) });
      }, 100);
    });
  };

  onCompositionEnd = (e) => {
    this.isInputtingChinese = false;
    this.onChange(e);
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
    const { newValue } = this.state;
    updated[column.key] = newValue;
    let errMessage = '';
    if (newValue && !isValidEmail(newValue)) {
      errMessage = 'Email invalid';
    }
    this.setState({ isEditorShow: false, errMessage });
    this.props.onCommit(updated);
  };

  onBlur = () => {
    this.onCommit();
  };

  setDisplayOption = (option = '') => {
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
          onMouseMove={() => this.setDisplayOption(option)}
          onMouseLeave={() => this.setDisplayOption()}
        >
          <span className="item-text">{option}</span>
        </DropdownItem>
      );
    });
  };

  render() {
    const { column } = this.props;
    let { isEditorShow, newValue, displayOptions, displayOption, errMessage } = this.state;
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
            value={displayOption || newValue}
            className="form-control text-editor-content"
            onChange={this.onChange}
            onCompositionStart={this.onCompositionStart}
            onCompositionEnd={this.onCompositionEnd}
            onBlur={this.onBlur}
            onClick={this.onEditorHandle}
            onKeyDown={this.onKeyDown}
            ref={ref => this.inputRef = ref}
            onPaste={this.onPaste}
            onCut={this.onCut}
            readOnly={this.props.isSubmitting}
          />
          {errMessage && <Alert color="danger" className="mt-2 mb-0">{gettext(errMessage)}</Alert>}
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

EmailEditorDropdown.propTypes = propTypes;

EmailEditorDropdown.defaultProps = {
  value: '',
};

export default EmailEditorDropdown;
