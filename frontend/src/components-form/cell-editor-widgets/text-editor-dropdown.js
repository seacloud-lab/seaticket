import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import MediaQuery from 'react-responsive';
import { Alert, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import CustomCamera from './custom-camera/custom-camera';
import ModalPortal from '../../components/modal-portal';
import { formatStringToRegexp, Utils } from '../../utils/utils';
import AutoFillObserver from '../../utils/auto-fill-observer';
import { gettext } from '../../utils/constants';
import { FORMAT_REG_EXP_LIST } from '../../pages/dtable-edit-form/widgets/CheckFormatRegExp';

const propTypes = {
  isSubmitting: PropTypes.bool,
  value: PropTypes.string,
  column: PropTypes.object,
  placeholder: PropTypes.string,
  onCommit: PropTypes.func,
  isEditorShow: PropTypes.bool,
  updateTabIndex: PropTypes.func,
  getHistoryCommitByColumnKey: PropTypes.func,
};

class TextEditorDropdown extends Component {

  constructor(props) {
    super(props);
    this.historyCommitOptions = this.getHistoryCommitOptions(props.column);
    this.state = {
      displayOptions: this.getDisplayOptions(),
      newValue: props.value || '',
      isEditorShow: props.isEditorShow || false,
      displayOption: '',
      showQrReader: false,
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
        this.setState({
          isEditorShow: true,
          displayOptions: this.getDisplayOptions(this.state.newValue),
        }, () => {
          setTimeout(() => {
            this.inputRef.focus();
          });
        });
      }
    }
    if (nextProps.value !== this.props.value) {
      this.setState({ newValue: nextProps.value });
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
    return this.historyCommitOptions.filter(option => {
      return option.includes(validNewValue);
    });
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
    let { column, isEditorShow } = this.props;
    const { newValue } = this.state;
    const { format_specification_value, enable_check_format, format_check_type } = column.data || {};
    updated[column.key] = newValue;
    if (newValue && enable_check_format && isEditorShow) {
      let isMatched = false;
      if (format_check_type === 'custom_format') {
        const reg = formatStringToRegexp(format_specification_value);
        isMatched = reg && !reg.test(newValue);
      } else {
        const reg = FORMAT_REG_EXP_LIST[format_check_type];
        isMatched = !reg.test(newValue);
      }
      this.setState({ errMessage: isMatched ? gettext('Input does not conform to specification') : '' });
    }
    this.setState({ isEditorShow: false });
    this.inputRef.blur();
    if (!newValue) {
      this.setState({ errMessage: '' });
    }
    this.props.onCommit(updated);
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
    } else if ((e.keyCode === 37 && selectionStart === 0) || (e.keyCode === 39 && selectionEnd === value.length)) {
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

  changeInputValue = value => {
    const { newValue } = this.state;
    this.setState({
      newValue: newValue + value,
    }, () => {
      this.onShowQrReaderToggle();
      this.onCommit();
    });
  };


  onShowQrReaderToggle = () => {
    let { showQrReader } = this.state;
    if (showQrReader) {
      this.customCameraRef.onCloseCamera();
    }
    this.setState({ showQrReader: !showQrReader });
  };

  render() {
    let { isEditorShow, newValue, displayOptions, displayOption, showQrReader, errMessage } = this.state;
    const { column } = this.props;
    const { enable_scan_code_entry: enableScanCodeEntry } = column;
    const isDesktop = Utils.isDesktop();
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
            className={`form-control text-editor-content ${enableScanCodeEntry ? 'pr-6' : ''}`}
            onChange={this.onChange}
            onCompositionStart={this.onCompositionStart}
            onCompositionEnd={this.onCompositionEnd}
            onBlur={this.onCommit}
            onClick={this.onEditorHandle}
            onKeyDown={this.onKeyDown}
            ref={ref => this.inputRef = ref}
            onPaste={this.onPaste}
            onCut={this.onCut}
            readOnly={this.props.isSubmitting}
            placeholder={this.props.placeholder}
          />
          {errMessage && <Alert color="danger" className="mt-2 mb-0">{errMessage}</Alert>}
          {!isDesktop && enableScanCodeEntry &&
            <span className="dtable-font dtable-icon-scan-code camera-auto-fill-value" onClick={this.onShowQrReaderToggle}></span>
          }
          {!isDesktop && showQrReader &&
            <ModalPortal>
              <CustomCamera
                changeInputValue={this.changeInputValue}
                onShowQrReaderToggle={this.onShowQrReaderToggle}
                ref={ref => this.customCameraRef = ref}
              />
            </ModalPortal>
          }
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

TextEditorDropdown.propTypes = propTypes;

TextEditorDropdown.defaultProps = {
  value: '',
};

export default TextEditorDropdown;
