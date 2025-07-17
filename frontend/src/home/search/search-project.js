import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { seaQAAPI } from '../../api/web-api';
import { gettext } from '../../constants';
import SearchResultItem from './search-result-item';
import { Utils } from '../../utils/utils';
import getWorkspaceName from '../utils/get-workspace-name';
import { getValueLength } from './search-utils';
import { IconButton } from '../../components';

const propTypes = {
  isPublic: PropTypes.bool,
  repoID: PropTypes.string,
  placeholder: PropTypes.string,
  onSearchedClick: PropTypes.func.isRequired,
};

class SearchProject extends Component {

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
      workspaceList: [],
      highLightIndex: 0,
    };
    this.inputValue = '';
    this.inputRef = null;
    this.searchContainer = React.createRef();
    this.mobileSearchContainer = React.createRef();
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

  onEnter = () => {
    this.props.onSearchedClick(this.state.resultItems[this.state.highLightIndex]);
    this.resetToDefault();
  };

  onFocusHandler = () => {
    this.setState({
      width: '30rem',
      isMaskShow: true,
      isCloseShow: true
    });
  };

  setFocus = () => {
    this.onFocusHandler();
    this.inputRef.focus();
  };

  onCloseHandler = (e) => {
    if (e) e.stopPropagation();
    this.resetToDefault();
  };

  onItemClickHandler = (item) => {
    this.resetToDefault();
    this.props.onSearchedClick(item);
  };

  onChangeHandler = (event) => {
    let _this = this;
    this.setState({ value: event.target.value });
    let newValue = event.target.value;
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
      _this.getSearchResult(queryData);
    }, 500);
  };

  getSearchResult(queryData) {
    this.setState({
      isResultShow: true,
      isResultGetted: false
    });
    this.sendRequest(queryData);
  }

  sendRequest = (queryData) => {
    const query_str = queryData.q.trim();
    seaQAAPI.searchItems(query_str, 'project').then(res => {
      const results = res.data.results;
      this.setState({
        resultItems: results,
        isResultGetted: true,
      });
    });
  };

  resetToDefault() {
    this.inputValue = null;
    this.setState({
      width: '',
      value: '',
      isMaskShow: false,
      isCloseShow: false,
      isResultShow: false,
      isResultGetted: false,
      resultItems: [],
      isSearchInputShow: false,
    });
  }

  renderSearchResult() {
    const { isResultShow, isResultGetted, resultItems, workspaceList, highLightIndex } = this.state;
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
          const path = getWorkspaceName(item, workspaceList);
          const getClassName = `project-item ${highLightIndex === index ? 'project-item-selected' : ''}`;
          return (
            <SearchResultItem
              key={path + item.id + index}
              item={item}
              onItemClickHandler={this.onItemClickHandler}
              path={path}
              getClassName={getClassName}
            />
          );
        })}
      </ul>
    );
  }

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

  render() {

    return (
      <>
        <div className="search-icon-container">
          <IconButton className="search-icon-left input-icon-addon" icon="search" />
        </div>
        {this.state.isSearchInputShow &&
          <div className="search">
            <div className={`search-mask ${this.state.isMaskShow ? '' : 'hide'}`} onClick={this.onCloseHandler}></div>
            <div className="search-container">
              <div className="search-result-container" ref={this.mobileSearchContainer}>
                {this.renderSearchResult()}
              </div>
            </div>
          </div>
        }
      </>
    );
  }
}

SearchProject.propTypes = propTypes;

export default SearchProject;
