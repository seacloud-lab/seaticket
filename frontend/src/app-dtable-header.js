import React from 'react';
import classnames from 'classnames';
import { siteRoot, mediaUrl, logoPath, logoWidth, logoHeight, siteTitle } from './constants';
import { isMac } from './utils/utils';
import { isEnter, isModF } from './utils/hotkey';
import Account from './components/common/account';
import DtableSearcher from './pages/dtable/search/dtable-searcher';
import { QUERY_TYPE } from './pages/dtable/search/dtable-searcher/constant';

const gettext = window.gettext;
const controlKey = isMac() ? '⌘' : 'Ctrl';


class AppDTableHeader extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDtableSearcher: false,
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
      this.onShowDtableSearcher();
    } else if (isEnter(e)) {
      if (document.activeElement && document.activeElement.id === 'search-container') {
        this.onShowDtableSearcher();
      }
    }
  };

  getQueryTypeByActiveTab = () => {
    switch (this.props.currentTab) {
      default: {
        return QUERY_TYPE.BASE;
      }
    }
  };

  onShowDtableSearcher = () => {
    if (!this.state.isShowDtableSearcher) {
      this.setState({ isShowDtableSearcher: true });
    }
  };

  onCloseDtableSearcher = () => {
    if (this.state.isShowDtableSearcher) {
      this.setState({ isShowDtableSearcher: false }, () => {
        setTimeout(() => {
          this.searchContainerRef?.focus();
        }, 0);
      });
    }
  };

  renderSearchBar = () => {
    const { isShowDtableSearcher } = this.state;
    return (
      <div className={classnames('search', { active: isShowDtableSearcher })} ref={ref => this.dtableSearcher = ref}>
        <div className={`search-mask ${isShowDtableSearcher ? '' : 'hide'}`} onClick={this.onCloseDtableSearcher} role="button"></div>
        <div
          tabIndex={0}
          className="search-container"
          onClick={this.onShowDtableSearcher}
          ref={ref => this.searchContainerRef = ref}
          id="search-container"
          role="button"
        >
          {!isShowDtableSearcher &&
            <div className="input-icon">
              <i className="search-icon-left input-icon-addon dtable-font dtable-icon-search"></i>
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
          {isShowDtableSearcher &&
            <DtableSearcher
              defaultQueryType={this.getQueryTypeByActiveTab()}
              onCloseDtableSearcher={this.onCloseDtableSearcher}
            />
          }
        </div>
      </div>
    );
  };

  render() {
    let logoUrl = logoPath.startsWith('http') ? logoPath : mediaUrl + logoPath;
    return (
      <header id="header" className="dtable-header">
        <div className="side-panel-north" style={{ flex: '0 0 22%' }}>
          <a className="dtable-logo" href={siteRoot}>
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

export default AppDTableHeader;
