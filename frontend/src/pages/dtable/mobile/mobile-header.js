import React, { Component } from 'react';
import PropTypes from 'prop-types';
import DtableMenuToolbar from '../toolbar/dtable-menu-toolbar';
import SearchDtable from '../search/search-dtable';
import { gettext } from '../../../constants';
import MobileCommonHeader from './mobile-common-header';


const MOBILE_HEADER_TITLE = {
  templates: 'Templates',
  apps: 'Apps',
  mine: 'Mine'
};

export default class MobileHeader extends Component {

  static propTypes = {
    selectedTab: PropTypes.string.isRequired,
    searchPlaceholder: PropTypes.string,
    onShowSidePanel: PropTypes.func.isRequired,
    loadWorkspaceList: PropTypes.func.isRequired,
    onSearchedClick: PropTypes.func.isRequired,
  };

  renderBasesHeader = () => {
    return (
      <header className="main-panel-north dtable-header">
        <DtableMenuToolbar
          onShowSidePanel={this.props.onShowSidePanel}
          loadWorkspaceList={this.props.loadWorkspaceList}
        />
        <div className="common-toolbar">
          <SearchDtable
            placeholder={this.props.searchPlaceholder || gettext('Search bases')}
            onSearchedClick={this.props.onSearchedClick}
          />
        </div>
      </header>
    );
  };

  render(){
    const { selectedTab } = this.props;
    if (selectedTab === 'bases') {
      return this.renderBasesHeader();
    }
    const title = MOBILE_HEADER_TITLE[selectedTab];
    return (
      <MobileCommonHeader title={gettext(title)} />
    );
  }
}
