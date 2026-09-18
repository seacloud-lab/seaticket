import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ClearIconButton from '@/components/clear-icon-button';
import IconButton from '../../icon-button';

import '../search-input/index.css';
import './history-search.css';

class GlobalSearchInput extends Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: props.value || '',
      oldSearchList: [],
    };
    this.isInputtingChinese = false;
    this.inputRef = null;
    this.globalSearchRef = null;
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClick);
  }

  componentWillUnmount() {
    this.inputRef = null;
    document.removeEventListener('click', this.handleClick);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      this.setState({ searchValue: nextProps.value });
    }
  }

  handleClick = (event) => {
    if (this.globalSearchRef && !this.globalSearchRef.contains(event.target) && this.state.oldSearchList.length) {
      this.setState({ oldSearchList: [] });
    }
  };

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
    this.setState({ searchValue: '' }, () => {
      this.props.onClear();
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

  render() {
    const { placeholder } = this.props;
    const { searchValue } = this.state;

    return (
      <div ref={ref => this.globalSearchRef = ref} className='seaqa-search-input-wrapper global-search-input-wrapper'>
        <IconButton icon="search" className="seaqa-search-input-search" style={{ height: 38, width: 36 }} />
        <input
          ref={ref => this.inputRef = ref}
          type="text"
          value={searchValue}
          className='form-control seaqa-search-input'
          onChange={this.onChange}
          autoFocus={true}
          placeholder={placeholder}
          onCompositionStart={this.onCompositionStart}
          onCompositionEnd={this.onCompositionEnd}
          onKeyDown={this.onKeyDown}
          style={{ paddingLeft: 36 }}
        />
        {this.state.searchValue &&
          <ClearIconButton onClick={this.onClear} style={{ top: 9, right: 9 }} />
        }
        {this.state.oldSearchList.length > 0 && (
          <div className="seaqa-search-input-history-search">
            {this.state.oldSearchList.map((item, index) => (
              <div key={index} className="seaqa-search-input-history-search-item" onClick={(e) => this.onClickOldSearch(e, item)}>
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
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  onClear: PropTypes.func,
  value: PropTypes.string,
  storeKey: PropTypes.string,
};

export default GlobalSearchInput;
