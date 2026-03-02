import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Router } from '@gatsbyjs/reach-router';
import { TabBar } from '../../../components';
import { AllWorkspaces, WorkspaceInMainPanel } from '../pc-main-panel';
import { gettext, siteRoot } from '../../../constants';
import MobileMine from '../../mobile/mobile-mine';
import MobileHeader from '../../mobile/mobile-header';
import { Icon } from '@/components';

import './index.css';

const ROUTES = {
  HOME: siteRoot,
  PROJECTS: `${siteRoot}project/`,
  PROJECT_DETAIL: `${siteRoot}project/:projectID`
};

const TAB_BAR_ITEMS = [
  {
    key: 'Projects',
    title: gettext('Projects'),
    value: 'projects',
    icon: <Icon symbol="home" className="tab-item" />,
    selectedIcon: <Icon symbol="home" className="tab-item selected-tab-item" />
  },
  {
    key: 'Mine',
    title: gettext('Mine'),
    value: 'mine',
    icon: <Icon symbol="mine" className="tab-item" />,
    selectedIcon: <Icon symbol="mine" className="tab-item selected-tab-item" />
  }
];

const propTypes = {
  searchPlaceholder: PropTypes.string,
  updateSidePanelGroups: PropTypes.func,
  onShowSidePanel: PropTypes.func,
  workspaceList: PropTypes.array,
  isWorkspaceListLoading: PropTypes.bool,
  loadWorkspaceList: PropTypes.func,
  onDeleteGroup: PropTypes.func,
  onCopyProject: PropTypes.func,
  onAddProject: PropTypes.func,
  onDeleteProject: PropTypes.func,
  errorMsg: PropTypes.string
};

class MobileMainPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTab: 'projects'
    };
  }

  onSearchedClick = (item) => {
    const url = `${siteRoot}workspace/${item.workspace_id}/project/${item.name}/`;
    location.href = url;
  };

  onSelectCurrentTab = (selectedTab) => {
    this.setState({ selectedTab });
  };

  renderMainContent = () => {
    const commonProps = {
      loadWorkspaceList: this.props.loadWorkspaceList,
      isWorkspaceListLoading: this.props.isWorkspaceListLoading,
      workspaceList: this.props.workspaceList,
      errorMsg: this.props.errorMsg,
      onDeleteGroup: this.props.onDeleteGroup,
      onDeleteProject: this.props.onDeleteProject,
      onCopyProject: this.props.onCopyProject,
      onAddProject: this.props.onAddProject,
      updateSidePanelGroups: this.props.updateSidePanelGroups
    };
    return (
      <Router className="reach-router" role='group'>
        <AllWorkspaces path={ROUTES.HOME} {...commonProps} />
        <AllWorkspaces path={ROUTES.PROJECTS} {...commonProps} />
        <WorkspaceInMainPanel path={ROUTES.PROJECT_DETAIL} {...commonProps} />
      </Router>
    );
  };

  renderTabBarContent = () => {
    const { selectedTab } = this.state;
    return (
      <TabBar
        unselectedTintColor="#999"
        tintColor="#ED7109"
        barTintColor="white"
      >
        {TAB_BAR_ITEMS.map(item => {
          const shouldRenderContent = selectedTab === 'projects' && item.value === 'projects';
          const innerContent = shouldRenderContent ? this.renderMainContent() : null;
          return (
            <TabBar.Item
              title={item.title}
              key={item.key}
              icon={item.icon}
              selectedIcon={item.selectedIcon}
              selected={selectedTab === item.value}
              onPress={() => this.onSelectCurrentTab(item.value)}
            >
              {innerContent}
            </TabBar.Item>
          );
        })}
      </TabBar>
    );
  };

  render() {
    const { selectedTab } = this.state;
    return (
      <div className={classnames('mobile-main-panel', { 'mobile-main-panel-mine': selectedTab === 'mine' })}>
        <MobileHeader
          selectedTab={selectedTab}
          searchPlaceholder={this.props.searchPlaceholder}
          onShowSidePanel={this.props.onShowSidePanel}
          onSearchedClick={this.onSearchedClick}
          loadWorkspaceList={this.props.loadWorkspaceList}
        />
        {selectedTab === 'mine' && <MobileMine />}
        {this.renderTabBarContent()}
      </div>
    );
  }
}

MobileMainPanel.propTypes = propTypes;

export default MobileMainPanel;
