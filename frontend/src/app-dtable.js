import React, { Fragment } from 'react';
import { globalHistory, LocationProvider, navigate } from '@gatsbyjs/reach-router';
import { createRoot } from 'react-dom/client';
import MediaQuery from 'react-responsive';
import { Modal } from 'reactstrap';
import { siteRoot } from './constants';
import SidePanel from './pages/dtable/side-panel';
import MainPanel from './pages/dtable/main-panel';
import IntroductionVideoDialog from './components/dialog/introduction-video-dialog';
import { Utils } from './utils/utils';
import MobileMainPanel from './pages/dtable/mobile/mobile-main-panel';
import AppDTableHeader from './app-dtable-header';

import './css/layout.css';
import './css/side-panel.css';
import './css/dtable.css';

class AppDTable extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      currentTab: null,
      isSidePanelClosed: true,
      isUpdateSidePanelGroups: false,
      isOpenGroupExpanded: false,
      isIntroductionOpen: false,
    };
    this.isDesktop = Utils.isDesktop();
  }

  componentDidMount() {
    const selectedTabs = [
    ];
    let currentTab = selectedTabs.find(tab => {
      return location.href.indexOf(`${siteRoot}${tab}`) > -1;
    });

    currentTab = currentTab ? currentTab : 'dtable';

    const { pathname } = location;
    const mainPath = `${siteRoot}${currentTab}`;
    const mainPathIndex = pathname.indexOf(mainPath);
    if (mainPathIndex > -1) {
      if (mainPath.indexOf('dtable') > -1) {
        let dtableID = pathname.slice(mainPathIndex + mainPath.length, pathname.length - 1);
        if (dtableID) {
          currentTab = `${currentTab}${dtableID}`;
          this.setState({ isOpenGroupExpanded: true });
        }
      }
    }
    this.setState({ currentTab });
    if (window.app.pageOptions.enableIntroductionVideo && window.app.pageOptions.needShowVideo) {
      this.openVideo();
    }
  }

  openVideo = () => {
    if (window.localStorage.getItem('load-introduction-video') === null) {
      this.toggleIntroductionDialog();
    }
    window.localStorage.setItem('load-introduction-video', false);
  };

  onTabClick = (tab) => {
    if (tab !== this.state.currentTab) {
      this.setState({ currentTab: tab });
    }
  };

  toggleIntroductionDialog = () => {
    this.setState({
      isIntroductionOpen: !this.state.isIntroductionOpen
    });
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
      this.setState({ currentTab: 'dtable' });
      let { pathname, href } = location;
      let paths = pathname.split('/');
      paths = paths.filter(item => item !== '');
      if (paths[paths.length - 2] === 'dtable') {
        let newURL = href.slice(0, href.indexOf('/dtable/') + 8);
        navigate(newURL);
      }
    }
    this.setState({ isUpdateSidePanelGroups: status });
  };

  render() {
    let { isSidePanelClosed, isIntroductionOpen } = this.state;
    return (
      <Fragment>
        {this.isDesktop &&
          <AppDTableHeader
            currentTab={this.state.currentTab}
          />
        }
        <div id="main">
          {this.state.currentTab &&
            <SidePanel
              currentTab={this.state.currentTab}
              isSidePanelClosed={isSidePanelClosed}
              onCloseSidePanel={this.toggleSidePanel}
              onTabClick={this.onTabClick}
              updateSidePanelGroups={this.updateSidePanelGroups}
              isUpdateSidePanelGroups={this.state.isUpdateSidePanelGroups}
              isOpenGroupExpanded={this.state.isOpenGroupExpanded}
              toggleGroupExpanded={this.toggleGroupExpanded}
              isDesktop={this.isDesktop}
            />
          }
          {this.isDesktop ?
            <MainPanel
              currentTab={this.state.currentTab}
              onShowSidePanel={this.toggleSidePanel}
              updateSidePanelGroups={this.updateSidePanelGroups}
            />
            :
            <MobileMainPanel
              onShowSidePanel={this.toggleSidePanel}
              updateSidePanelGroups={this.updateSidePanelGroups}
            />
          }
          <MediaQuery query="(max-width: 767.8px)">
            <Modal isOpen={!isSidePanelClosed} toggle={this.toggleSidePanel} contentClassName="d-none"></Modal>
          </MediaQuery>
        </div>
        {isIntroductionOpen && <IntroductionVideoDialog toggle={this.toggleIntroductionDialog}/>}
      </Fragment>
    );
  }
}

const root = createRoot(document.getElementById('wrapper'));
root.render(
  <LocationProvider history={globalHistory}>
    <AppDTable />
  </LocationProvider>
);
