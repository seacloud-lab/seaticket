import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { isFunction } from '../../utils/utils';
import IconButton from '../icon-button';

import './index.css';
import './global-search-input.css';

class GlobalSearchInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: props.value,
      oldSearchList: [],
    };
    this.isInputtingChinese = false;
    this.inputRef = null;
  }

  static defaultProps = {
    disabled: false,
    value: '',
  };

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.setState({ searchValue: nextProps.value });
    }
  }

  componentWillUnmount() {
    this.inputRef = null;
  }

  onCompositionStart = () => {
    this.isInputtingChinese = true;
  };

  onChange = (e) => {
    const searchValue = e.target.value || '';
    const { storeKey } = this.props;
    const getFilteredList = () => {
      if (!storeKey || !searchValue) return [];
      const storedList = window.localStorage.getItem(storeKey) || '[]';
      return JSON.parse(storedList).filter(item => item.includes(searchValue));
    };
    const oldSearchList = getFilteredList();
    this.setState({
      searchValue,
      oldSearchList,
    });
  };

  onCompositionEnd = (e) => {
    this.isInputtingChinese = false;
    this.onChange(e);
  };

  onClear = () => {
    const { onClear } = this.props;
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

  onKeyDown = (e) => {
    const { onKeyDown = () => {}, onChange = () => {} } = this.props;
    onKeyDown(e);
    if (e.keyCode === 13) {
      onChange(this.state.searchValue.trim());
      this.setState({ oldSearchList: [] });
    }
  };

  onClickOldSearch = (e, item) => {
    e.stopPropagation();
    const { onChange } = this.props;
    onChange(item);
    this.setState({ oldSearchList: [], searchValue: item });
  };

  renderClear = () => {
    const { onClear, size = 38 } = this.props;
    const { searchValue } = this.state;
    if (!isFunction(onClear) || !searchValue) return null;
    const clearButtonSize = 20;
    const verticalOffset = (size - clearButtonSize) / 2;
    const clearButtonStyle = {
      height: clearButtonSize,
      width: clearButtonSize,
      top: verticalOffset,
      right: verticalOffset
    };
    return (
      <IconButton
        icon="x"
        className="sea-qa-search-input-clear"
        onClick={this.onClear}
        style={clearButtonStyle}
      />
    );
  };

  render() {
    const { placeholder, autoFocus, className, inputClassName, disabled, isShowSearchIcon = true, size = 38, onClear, style } = this.props;
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
          onKeyDown={this.onKeyDown}
          disabled={disabled}
          style={{ height: size, paddingLeft: isShowSearchIcon ? size + 2 : 12 }}
        />
        {this.renderClear()}
        {this.state.oldSearchList.length > 0 && (
          <div className="sea-qa-search-input-old-search">
            {this.state.oldSearchList.map((item, index) => (
              <div key={index} className="sea-qa-search-input-old-search-item" onClick={(e) => this.onClickOldSearch(e, item)}>
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

GlobalSearchInput.propTypes = {
  placeholder: PropTypes.string,
  autoFocus: PropTypes.bool,
  isShowSearchIcon: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.number,
  onClear: PropTypes.func,
  value: PropTypes.string,
  storeKey: PropTypes.string,
};

export default GlobalSearchInput;
