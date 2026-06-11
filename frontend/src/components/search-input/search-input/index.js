import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { isFunction } from '@/utils/type-detection';
import IconButton from '../../icon-button';
import ClearIconButton from '../../clear-icon-button';

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

  static defaultProps = {
    wait: 100,
    disabled: false,
    value: '',
  };

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
    const { onChange, wait } = this.props;
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
    const { searchValue } = this.state;
    if (!isShowClearIcon || !isFunction(onClear) || !searchValue) return null;
    const CLEAR_ICON_HEIGHT = 20;
    return (
      <ClearIconButton
        onClick={this.onClear}
        // Icon should set right to 4px, but here we set it to 5px, to avoid overlapping with the 1px border
        style={{ top: (size - CLEAR_ICON_HEIGHT) / 2, right: 5 }}
      />
    );
  };

  render() {
    const {
      placeholder, autoFocus, className, inputClassName, disabled, style,
      isShowSearchIcon = true, size = 38, isShowClearIcon = false,
      onClear, onKeyDown,
    } = this.props;
    const { searchValue } = this.state;

    const isSmallSize = size <= 30;
    let paddingLeft = size - 2;
    if (!isShowSearchIcon) {
      paddingLeft = isSmallSize ? 8 : 12;
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
          <IconButton icon="search" className="seaqa-search-input-search" style={{ height: size, width: size - 2 }} />
        )}
        <input
          ref={ref => this.inputRef = ref}
          type="text"
          value={searchValue}
          className={classnames('form-control seaqa-search-input', inputClassName, { 'small-size': isSmallSize })}
          onChange={this.onChange}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onKeyDown={onKeyDown}
          disabled={disabled}
          style={{ height: size, paddingLeft: paddingLeft, paddingRight: paddingRight }}
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
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  wait: PropTypes.number,
  disabled: PropTypes.bool,
  size: PropTypes.number,
  onClear: PropTypes.func,
  value: PropTypes.string,
};

export default SearchInput;
