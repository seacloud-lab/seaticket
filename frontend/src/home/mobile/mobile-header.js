import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ProjectMenuToolbar from './toolbar/project-menu-toolbar';
// import SearchProject from '../search/search-project';
import { gettext } from '../../constants';
import { MobileCommonHeader } from '../../components';

const MOBILE_HEADER_TITLE = {
  projects: 'Projects',
  mine: gettext('Mine')
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
      <header className="main-panel-north sea-qa-home-header">
        <ProjectMenuToolbar
          onShowSidePanel={this.props.onShowSidePanel}
          loadWorkspaceList={this.props.loadWorkspaceList}
        />
        <div className="common-toolbar">
          {/* <SearchProject
            placeholder={this.props.searchPlaceholder || gettext('Search projects')}
            onSearchedClick={this.props.onSearchedClick}
          /> */}
        </div>
      </header>
    );
  };

  render(){
    const { selectedTab } = this.props;
    if (selectedTab === 'projects') {
      return this.renderBasesHeader();
    }
    const title = MOBILE_HEADER_TITLE[selectedTab];
    return (
      <MobileCommonHeader title={title} />
    );
  }
}
