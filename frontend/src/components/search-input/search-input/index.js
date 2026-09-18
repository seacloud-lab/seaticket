import React, { Component } from 'react';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { isFunction } from '@/utils/type-detection';
import ClearIconButton from '../../clear-icon-button';
import IconButton from '../../icon-button';

import './index.css';

class SearchInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: props.value || '',
    };
    this.isInputtingChinese = false;
    this.timer = null;
    this.inputRef = null;
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.setState({ searchValue: nextProps.value });
    }
  }

  componentWillUnmount() {
    this.timer && clearTimeout(this.timer);
    this.timer = null;
    this.inputRef = null;
  }

  onCompositionStart = () => {
    this.isInputtingChinese = true;
  };

  onChange = (e) => {
    this.timer && clearTimeout(this.timer);
    const { onChange, wait = 100 } = this.props;
    let text = e.target.value;
    this.setState({ searchValue: text || '' }, () => {
      if (this.isInputtingChinese) return;
      this.timer = setTimeout(() => {
        onChange && onChange(this.state.searchValue.trim());
      }, wait);
    });
  };

  onCompositionEnd = (e) => {
    this.isInputtingChinese = false;
    this.onChange(e);
  };

  onClear = () => {
    const { onClear } = this.props;
    this.timer && clearTimeout(this.timer);
    this.setState({ searchValue: '' }, () => {
      onClear && onClear();
    });
  };

  setFocus = (isSelectAllText) => {
    if (this.inputRef === document.activeElement) return;
    this.inputRef.focus();
    if (isSelectAllText) {
      const txtLength = this.state.searchValue.length;
      this.inputRef.setSelectionRange(0, txtLength);
    }
  };

  getSearchValue = () => {
    return this.state.searchValue || '';
  };

  renderClear = () => {
    const { onClear, size = 38, isShowClearIcon = false } = this.props;
    if (!isShowClearIcon || !isFunction(onClear)) return null;
    const CLEAR_ICON_HEIGHT = 20;
    const gap = (size - CLEAR_ICON_HEIGHT) / 2;
    return (
      <ClearIconButton
        onClick={this.onClear}
        style={{ top: gap, right: gap }}
      />
    );
  };

  render() {
    const {
      placeholder, autoFocus, className, inputClassName, disabled = false, style,
      isShowSearchIcon = true, size = 38, isShowClearIcon = false,
      onClear, onKeyDown, inputStyle = {},
    } = this.props;
    const { searchValue } = this.state;

    let paddingLeft = 8;
    if (isShowSearchIcon) {
      paddingLeft = 8 + 12 + 14; // search icon 14px, icon left 12px, icon right 8px
    }
    let paddingRight = 8;
    if (isShowClearIcon && isFunction(onClear)) {
      paddingRight = 30;
    }

    return (
      <div
        className={classnames('seaqa-search-input-wrapper', className, {
          'display-search-icon': isShowSearchIcon,
          'display-clear-icon': isFunction(onClear)
        })}
        style={{ ...style, height: size }}
      >
        {isShowSearchIcon && (
          // search icon width === input padding left, so use width: paddingLeft
          <IconButton icon="search" className="seaqa-search-input-search" style={{ height: size, width: paddingLeft }} />
        )}
        <input
          ref={ref => this.inputRef = ref}
          type="text"
          value={searchValue}
          className={classnames('form-control seaqa-search-input', inputClassName)}
          onChange={this.onChange}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onKeyDown={onKeyDown}
          disabled={disabled}
          style={Object.assign({}, { height: size, paddingLeft, paddingRight, fontSize: size <= 30 ? '13px' : '14px' }, inputStyle)}
          name="search-input"
          autoComplete="off"
        />
        {this.renderClear()}
      </div>
    );
  }
}

SearchInput.propTypes = {
  placeholder: PropTypes.string,
  autoFocus: PropTypes.bool,
  isShowSearchIcon: PropTypes.bool,
  isShowClearIcon: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  wait: PropTypes.number,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf([28, 32, 38]),
  onClear: PropTypes.func,
  value: PropTypes.string,
  inputStyle: PropTypes.object,
};

export default SearchInput;
