import React, { Fragment } from 'react';
import { globalHistory, LocationProvider, navigate } from '@gatsbyjs/reach-router';
import { createRoot } from 'react-dom/client';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import { siteRoot } from '../constants';
import Header from './header';
import SidePanel from './side-panel';
import { Utils } from '../utils/utils';
import MainPanel from './main-panel';
import { NotificationProvider } from '@/components/common/notification/hooks/notification';

import '../css/layout.css';
import '../css/side-panel.css';
import './index.css';
import '@/css/toolbar.css';

class Home extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentTab: null,
      isSidePanelClosed: true,
      isUpdateSidePanelGroups: false,
      isOpenGroupExpanded: false,
    };
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    const selectedTabs = [
      'project/trash'
    ];
    let currentTab = selectedTabs.find(tab => {
      return location.href.indexOf(`${siteRoot}${tab}`) > -1;
    });

    currentTab = currentTab ? currentTab : 'project';

    const { pathname } = location;
    const mainPath = `${siteRoot}${currentTab}`;
    const mainPathIndex = pathname.indexOf(mainPath);
    if (mainPathIndex > -1) {
      if (mainPath.indexOf('project') > -1) {
        let projectID = pathname.slice(mainPathIndex + mainPath.length, pathname.length - 1);
        if (projectID) {
          currentTab = `${currentTab}${projectID}`;
          this.setState({ isOpenGroupExpanded: true });
        }
      }
    }
    this.setState({ currentTab });
  }

  onTabClick = (tab) => {
    if (tab !== this.state.currentTab) {
      this.setState({ currentTab: tab });
    }
  };

  toggleSidePanel = () => {
    this.setState({
      isSidePanelClosed: !this.state.isSidePanelClosed
    });
  };

  toggleGroupExpanded = () => {
    this.setState({ isOpenGroupExpanded: !this.state.isOpenGroupExpanded });
  };

  updateSidePanelGroups = (status, isDeleteGroup) => {
    if (isDeleteGroup) {
      this.setState({ currentTab: 'project' });
      let { pathname, href } = location;
      let paths = pathname.split('/');
      paths = paths.filter(item => item !== '');
      if (paths[paths.length - 2] === 'project') {
        let newURL = href.slice(0, href.indexOf('/project/') + 8);
        navigate(newURL);
      }
    }
    this.setState({ isUpdateSidePanelGroups: status });
  };

  render() {
    let { isSidePanelClosed, currentTab, isOpenGroupExpanded, isUpdateSidePanelGroups } = this.state;
    return (
      <Fragment>
        <NotificationProvider>
          {this.isDesktop && (<Header currentTab={currentTab} />)}
          <div id="main">
            {currentTab && (
              <SidePanel
                currentTab={currentTab}
                isSidePanelClosed={isSidePanelClosed}
                isUpdateSidePanelGroups={isUpdateSidePanelGroups}
                isOpenGroupExpanded={isOpenGroupExpanded}
                onCloseSidePanel={this.toggleSidePanel}
                onTabClick={this.onTabClick}
                updateSidePanelGroups={this.updateSidePanelGroups}
                toggleGroupExpanded={this.toggleGroupExpanded}
                isDesktop={this.isDesktop}
              />
            )}
            <MainPanel
              isDesktop={this.isDesktop}
              currentTab={currentTab}
              onShowSidePanel={this.toggleSidePanel}
              updateSidePanelGroups={this.updateSidePanelGroups}
            />
            <MediaQuery query="(max-width: 767.8px)">
              <Modal isOpen={!isSidePanelClosed} toggle={this.toggleSidePanel} contentClassName="d-none"></Modal>
            </MediaQuery>
          </div>
        </NotificationProvider>
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <LocationProvider history={globalHistory}>
    <Home />
  </LocationProvider>
);
