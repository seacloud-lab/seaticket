import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { isFunction } from '../../utils/utils';
import IconButton from '../icon-button';

import './index.css';

class SearchInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: props.value,
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

  renderClear = () => {
    const { onClear, size = 38 } = this.props;
    const { searchValue } = this.state;
    if (!isFunction(onClear) || !searchValue) return null;
    return (
      <IconButton icon="x" className="sea-qa-search-input-clear" onClick={this.onClear} style={{ height: 20, width: 20, top: (size - 20) / 2, right: (size - 20) / 2 }} />
    );
  };

  render() {
    const { placeholder, autoFocus, className, inputClassName, onKeyDown, disabled, isShowSearchIcon = true, size = 38, onClear, style } = this.props;
    const { searchValue } = this.state;

    return (
      <div
        className={classnames('sea-qa-search-input-wrapper', className, { 'display-search-icon': isShowSearchIcon, 'display-clear-icon': isFunction(onClear) })}
        style={{ ...style, height: size }}
      >
        {isShowSearchIcon && (
          <IconButton icon="search" className="sea-qa-search-input-search" style={{ height: size, width: size }} />
        )}
        <input
          ref={ref => this.inputRef = ref}
          type="text"
          value={searchValue}
          className={classnames('form-control sea-qa-search-input', inputClassName)}
          onChange={this.onChange}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onKeyDown={onKeyDown}
          disabled={disabled}
          style={{ height: size, paddingLeft: size + 2 }}
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
  size: PropTypes.string,
  onClear: PropTypes.func,
  value: PropTypes.string,
};

export default SearchInput;
