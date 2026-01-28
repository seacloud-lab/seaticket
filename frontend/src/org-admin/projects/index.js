import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import { gettext, orgID } from '@/constants';
import { TopBar, Main } from '../main-panel';
import TrashProjects from './trash-projects';
import { AdminSearch, ProjectsTable } from '@/components';
import orgAdminAPI from '../api';

const siteRoot = window.app.config.siteRoot;

const OrgProjectsPropTypes = {
  currentTab: PropTypes.string.isRequired,
  onCloseSidePanel: PropTypes.func,
  tabItemClick: PropTypes.func.isRequired
};

class Projects extends React.Component {
  constructor(props) {
    super(props);
    this.state = ({
      isShowTrashEmptyConfirmDialog: false,
    });
  }

  tabItemClick = (tab) => {
    this.props.tabItemClick(tab);
  };

  onTrashEmptyConfirmDialogToggle = () => {
    this.setState({ isShowTrashEmptyConfirmDialog: !this.state.isShowTrashEmptyConfirmDialog });
  };

  getSearch = () => {
    return (<AdminSearch placeholder={gettext('Search projects')} onSubmit={this.searchItems} />);
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}org/search-projects/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}></TopBar>
        <Main
          title={(
            <ul className="nav">
              <li className={classnames('nav-item', { 'active': this.props.currentTab === 'projects' })} onClick={() => this.tabItemClick('projects')}>
                <span className={`nav-link pt-0 pb-0 ${this.props.currentTab === 'projects' ? 'active' : ''}`}>{gettext('Projects')}</span>
              </li>
              <li className={classnames('nav-item', { 'active': this.props.currentTab === 'trash' })} onClick={() => this.tabItemClick('trash')}>
                <span className={`nav-link pt-0 pb-0 ${this.props.currentTab === 'trash' ? 'active' : ''}`} >{gettext('Trash')}</span>
              </li>
            </ul>
          )}
          titleClassName="cur-view-path org-user-nav tab-nav-container mb-4"
        >
          {this.props.currentTab === 'projects' && (
            <ProjectsTable
              columns={[
                { name: '', key: 'icon', width: 44, isFixed: true },
                { name: gettext('Name'), key: 'name', width: 0.18 },
                { name: 'ID', key: 'uuid', width: 0.32 },
                { name: 'Owner', key: 'owner', width: 0.25 },
                { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
                { name: '', key: 'placeholder', width: 0.1 },
                { name: '', key: 'op', width: 44, isFixed: true }
              ]}
              api={(page, perPage) => orgAdminAPI.orgAdminListProjects(orgID, page, perPage)}
              onDelete={(project) => orgAdminAPI.orgAdminDeleteProject(orgID, project.id)}
            />
          )}
          {this.props.currentTab === 'trash' && (
            <>
              <Button
                color="secondary"
                className="operation-item"
                title={gettext('Clean')}
                aria-label={gettext('Clean')}
                onClick={this.onTrashEmptyConfirmDialogToggle}
              >
                {gettext('Clean')}
              </Button>
              <TrashProjects
                isShowTrashEmptyConfirmDialog={this.state.isShowTrashEmptyConfirmDialog}
                onTrashEmptyConfirmDialogToggle={this.onTrashEmptyConfirmDialogToggle}
              />
            </>
          )}
        </Main>
      </>
    );
  }
}

Projects.propTypes = OrgProjectsPropTypes;

export default Projects;
