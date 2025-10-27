import React from 'react';
import classnames from 'classnames';
import { siteRoot, mediaUrl, logoPath, logoWidth, logoHeight, siteTitle } from '../../constants';
import { isMac } from '../../utils/utils';
import { isEnter, isModF } from '../../utils/hotkey';
import Account from '../../components/account';
import ProjectSearcher from '../search/project-searcher';
import { QUERY_TYPE } from '../search/project-searcher/constant';
import { IconButton } from '../../components';

import './index.css';

const gettext = window.gettext;
const controlKey = isMac() ? '⌘' : 'Ctrl';

class Header extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowSearcher: false,
    };
    this.searchContainerRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onDocumentKeydown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onDocumentKeydown);
  }

  onDocumentKeydown = (e) => {
    if (isModF(e)) {
      e.preventDefault();
      this.onShowSearcher();
    } else if (isEnter(e)) {
      if (document.activeElement && document.activeElement.id === 'search-container') {
        this.onShowSearcher();
      }
    }
  };

  getQueryTypeByActiveTab = () => {
    switch (this.props.currentTab) {
      default: {
        return QUERY_TYPE.PROJECT;
      }
    }
  };

  onShowSearcher = () => {
    if (!this.state.isShowSearcher) {
      this.setState({ isShowSearcher: true });
    }
  };

  onCloseSearcher = () => {
    if (this.state.isShowSearcher) {
      this.setState({ isShowSearcher: false }, () => {
        setTimeout(() => {
          this.searchContainerRef?.focus();
        }, 0);
      });
    }
  };

  renderSearchBar = () => {
    const { isShowSearcher } = this.state;
    return (
      <div className={classnames('search', { active: isShowSearcher })}>
        <div className={`search-mask ${isShowSearcher ? '' : 'hide'}`} onClick={this.onCloseSearcher} role="button"></div>
        <div
          tabIndex={0}
          className="search-container"
          onClick={this.onShowSearcher}
          ref={ref => this.searchContainerRef = ref}
          id="search-container"
          role="button"
        >
          {!isShowSearcher &&
            <div className="input-icon">
              <IconButton className="input-icon-addon h-100 sea-qa-search-icon-btn" icon="search" />
              <span
                type="text"
                className="form-control search-input"
                name="query"
                autoComplete="off"
                title={`${gettext('Search')} ( ${controlKey} + f )`}
                aria-label={`${gettext('Search')} ( ${controlKey} + f )`}
              >
                {`${gettext('Search')} ( ${controlKey} + f )`}
              </span>
            </div>
          }
          {isShowSearcher &&
            <ProjectSearcher
              defaultQueryType={this.getQueryTypeByActiveTab()}
              onCloseSearcher={this.onCloseSearcher}
            />
          }
        </div>
      </div>
    );
  };

  render() {
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <header id="header" className="sea-qa-home-header">
        <div className="side-panel-north" style={{ flex: '0 0 22%' }}>
          <a className="sea-qa-logo" href={siteRoot}>
            <img
              src={logoUrl}
              height={logoHeight}
              width={logoWidth}
              title={siteTitle}
              alt={gettext('SeaTable logo')}
              aria-label={gettext('SeaTable logo')}
            />
          </a>
        </div>
        <div className="main-panel-north" style={{ flex: '1 0 78%' }}>
          <div className="common-toolbar">
            {this.renderSearchBar()}
            <Account />
          </div>
        </div>
      </header>
    );
  }

}

export default Header;
