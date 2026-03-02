import React from 'react';
import PropTypes from 'prop-types';
import { Router } from '@gatsbyjs/reach-router';
import AllWorkspaces from './all-workspaces';
import WorkspaceInMainPanel from './workspace-in-main-panel';
import MyProjectsTrash from './my-projects-trash';
import eventBus from '@/utils/event-bus';
import AllInbox from './all-inbox';

const siteRoot = window.app.config.siteRoot;
const gettext = window.gettext;

const ROUTES = {
  HOME: siteRoot,
  PROJECTS: `${siteRoot}projects/`,
  PROJECT_DETAIL: `${siteRoot}project/:projectID`,
  PROJECT_TRASH: `${siteRoot}project/trash/`
};

const propTypes = {
  currentTab: PropTypes.string,
  onShowSidePanel: PropTypes.func.isRequired,
  updateSidePanelGroups: PropTypes.func,
  loadWorkspaceList: PropTypes.func,
  isWorkspaceListLoading: PropTypes.bool,
  workspaceList: PropTypes.array,
  errorMsg: PropTypes.string,
  onDeleteGroup: PropTypes.func,
  onDeleteProject: PropTypes.func,
  onCopyProject: PropTypes.func,
  onAddProject: PropTypes.func,
};

class MainPanel extends React.Component {

  constructor(props) {
    super(props);
    this.mainPanelRef = React.createRef();
  }

  componentDidMount() {
    eventBus.subscribe('home-side-panel-width', this.handleResize);
  }

  componentWillUnmount() {
    eventBus.unsubscribe('home-side-panel-width', this.handleResize);
  }

  handleResize = (sideWidth) => {
    if (this.mainPanelRef.current) {
      this.mainPanelRef.current.style.width = `calc(100% - ${sideWidth}px)`;
    }
  };

  render() {
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
      <div className="main-panel" aria-label={gettext('Main panel')} ref={this.mainPanelRef}>
        <Router className="reach-router" role='group'>
          <AllWorkspaces path={ROUTES.HOME} {...commonProps} />
          <AllWorkspaces path={ROUTES.PROJECTS} {...commonProps} />
          <WorkspaceInMainPanel path={ROUTES.PROJECT_DETAIL} {...commonProps} />
          <MyProjectsTrash path={ROUTES.PROJECT_TRASH} {...commonProps} />
        </Router>
        <AllInbox />
      </div>
    );
  }
}

MainPanel.propTypes = propTypes;

export default MainPanel;
export {
  AllWorkspaces,
  WorkspaceInMainPanel,
};
