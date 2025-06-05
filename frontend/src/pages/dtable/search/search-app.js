import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import MediaQuery from 'react-responsive';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import AppItem from '../universal-apps/app-item';
import { Utils } from '../../../utils/utils';
import { getValueLength } from './search-utils';

const propTypes = {
  placeholder: PropTypes.string,
};

class SearchApp extends Component {

  constructor(props) {
    super(props);
    this.state = {
      width: 'default',
      value: '',
      resultItems: [],
      isMaskShow: false,
      isResultShow: false,
      isResultGetted: false,
      isCloseShow: false,
      isSearchInputShow: false, // for mobile
      highLightIndex: 0,
    };
    this.inputValue = '';
    this.inputRef = null;
    this.searchContainer = React.createRef();
    this.mobileSearchContainer = React.createRef();
    this.appItemRefs = [];
  }

  componentDidMount() {
    let innerHeight = window.innerHeight;
    if (this.searchContainer.current) {
      this.searchContainer.current.style.maxHeight = (innerHeight - 100) + 'px';
    }
    document.addEventListener('keydown', this.onHotKey, true);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey, true);
    this.inputRef = null;
  }

  onHotKey = (e) => {
    if (e.keyCode === Utils.keyCodes.enter && this.state.resultItems.length > 0) {
      this.onEnter();
    } else if (e.keyCode === Utils.keyCodes.up) {
      this.onUpArrow(e);
    } else if (e.keyCode === Utils.keyCodes.down) {
      this.onDownArrow(e);
    } else if (e.keyCode === Utils.keyCodes.esc) {
      this.onCloseHandler();
      this.inputRef.blur();
    }
  };

  onEnter = () => {
    if (this.state.resultItems.length > 0 && this.appItemRefs[this.state.highLightIndex]) {
      this.appItemRefs[this.state.highLightIndex].openApp();
    }
  };

  onUpArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!this.searchContainer.current) return;
    const maxShowIndex = Math.floor(parseInt(this.searchContainer.current.style.maxHeight) / 56);
    if (this.state.highLightIndex > 0) {
      this.setState({ highLightIndex: this.state.highLightIndex - 1 }, () => {
        if (this.state.highLightIndex < this.state.resultItems.length - maxShowIndex) {
          this.ulRef.scrollTop -= 56;
        }
      });
    }
  };

  onDownArrow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!this.searchContainer.current) return;
    const maxShowIndex = Math.floor(parseInt(this.searchContainer.current.style.maxHeight) / 56);
    if (this.state.highLightIndex < this.state.resultItems.length - 1) {
      this.setState({ highLightIndex: this.state.highLightIndex + 1 }, () => {
        if (this.state.highLightIndex >= maxShowIndex ) {
          this.ulRef.scrollTop += 56;
        }
      });
    }
  };

  onCloseHandler = (e) => {
    if (e) e.stopPropagation();
    this.resetToDefault();
  };

  resetToDefault = () => {
    this.inputValue = null;
    this.setState({
      width: '',
      value: '',
      highLightIndex: 0,
      isMaskShow: false,
      isCloseShow: false,
      isResultShow: false,
      isResultGetted: false,
      resultItems: [],
      isSearchInputShow: false,
    });
  };

  setFocus = () => {
    this.onFocusHandler();
    this.inputRef.focus();
  };

  onFocusHandler = () => {
    this.setState({
      width: '30rem',
      isMaskShow: true,
      isCloseShow: true
    });
  };

  handleSearchChange = (event) => {
    const newValue = event.target.value;
    this.setState({ value: newValue });
    if (this.inputValue === newValue.trim()) {
      return false;
    }
    this.inputValue = newValue.trim();

    if (this.inputValue === '' || getValueLength(this.inputValue) < 3) {
      this.setState({
        isResultShow: false,
        isResultGetted: false
      });
      if (this.timer) {
        clearTimeout(this.timer);
      }
      return false;
    }
    let queryData = {
      q: newValue,
    };

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.getSearchResult(queryData);
    }, 500);
  };

  getSearchResult = (queryData) => {
    this.setState({
      isResultShow: true,
      isResultGetted: false
    });
    this.sendRequest(queryData);
  };

  sendRequest = (queryData) => {
    let query_str = queryData.q.trim();
    dtableWebAPI.searchItems(query_str, 'app').then(res => {
      let apps = res.data.results;
      this.setState({
        highLightIndex: 0,
        resultItems: apps,
        isResultGetted: true,
      });
    });
  };

  onSearchToggle = () => {
    this.setState({
      isSearchInputShow: !this.state.isSearchInputShow,
      isMaskShow: !this.state.isMaskShow,
    }, () => {
      if (this.mobileSearchContainer.current) {
        this.mobileSearchContainer.current.style.maxHeight = (window.innerHeight - 150) + 'px';
      }
    });
  };

  setHighLightIndex = (index) => {
    this.setState({ highLightIndex: index });
  };

  renderSearchResult = () => {
    const { isResultShow, isResultGetted, resultItems, highLightIndex } = this.state;
    if (!isResultShow) {
      return;
    }
    if (!isResultGetted || getValueLength(this.inputValue) < 3) {
      return (
        <span className="loading-icon loading-tip"></span>
      );
    }
    if (!resultItems.length) {
      return (
        <div className="search-result-none">{gettext('No results matching')}</div>
      );
    }
    return (
      <ul className="search-result-list" ref={ref => this.ulRef = ref}>
        {resultItems.map((item, index) => {
          const className = `search-app-item ${highLightIndex === index ? 'app-item-selected' : ''}`;
          return (
            <AppItem
              key={item.app_id}
              index={index}
              ref={ref => this.appItemRefs[index] = ref}
              appItem={item}
              className={className}
              isAdmin={true}
              setHighLightIndex={this.setHighLightIndex}
            />
          );
        })}
      </ul>
    );
  };

  render() {
    let width = this.state.width !== 'default' ? this.state.width : '';
    let style = { 'width': width };

    return (
      <Fragment>
        <MediaQuery query="(min-width: 768px)">
          <div className="search">
            <div className={`search-mask ${this.state.isMaskShow ? '' : 'hide'}`} onClick={this.onCloseHandler}></div>
            <div className="search-container" onClick={this.onFocusHandler}>
              <div className="input-icon">
                <i className="search-icon-left input-icon-addon dtable-font dtable-icon-search"></i>
                <input
                  type="text"
                  className="form-control search-input"
                  name="query"
                  placeholder={this.props.placeholder}
                  style={style}
                  value={this.state.value}
                  onChange={this.handleSearchChange}
                  autoComplete="off"
                  ref={ref => this.inputRef = ref}
                  aria-label={gettext('Search')}
                />
                {this.state.isCloseShow && <i className='search-icon-right input-icon-addon dtable-font dtable-icon-cancel' onClick={this.onCloseHandler}></i>}
              </div>
              <div className="search-result-container" ref={this.searchContainer}>
                {this.renderSearchResult()}
              </div>
            </div>
          </div>
        </MediaQuery>
        <MediaQuery query="(max-width: 767.8px)">
          <div className="search-icon-container app-page">
            <i className="search-icon dtable-font dtable-icon-search" onClick={this.onSearchToggle}></i>
          </div>
          {this.state.isSearchInputShow &&
            <div className="search">
              <div className={`search-mask ${this.state.isMaskShow ? '' : 'hide'}`} onClick={this.onCloseHandler}></div>
              <div className="search-container">
                <div className="input-icon">
                  <input
                    type="text"
                    className="form-control search-input"
                    name="query"
                    placeholder={this.props.placeholder}
                    style={style}
                    value={this.state.value}
                    onFocus={this.onFocusHandler}
                    onChange={this.handleSearchChange}
                    autoComplete="off"
                    aria-label={gettext('Search')}
                  />
                  <i className="search-icon-left input-icon-addon dtable-font dtable-icon-search" style={{ right: 0 }}></i>
                </div>
                <div className="search-result-container" ref={this.mobileSearchContainer}>
                  {this.renderSearchResult()}
                </div>
              </div>
            </div>
          }
        </MediaQuery>
      </Fragment>
    );
  }
}

SearchApp.propTypes = propTypes;

export default SearchApp;
