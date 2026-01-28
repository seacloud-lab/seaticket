import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { navigate } from '@gatsbyjs/reach-router';
import { AdminSearch, ProjectsTable } from '@/components';
import sysAdminAPI from '@/sys-admin/api';
import { gettext, siteRoot } from '@/constants';
import ProjectNav from './project-nav';
import { TopBar, Main } from '../main-panel';

class AllProjects extends Component {

  getSearch = () => {
    return (<AdminSearch placeholder={gettext('Search projects')} onSubmit={this.searchItems} />);
  };

  searchItems = (keyword) => {
    navigate(`${siteRoot}sys/search-projects/?query=${encodeURIComponent(keyword)}`);
  };

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} search={this.getSearch()}/>
        <Main
          title={<ProjectNav currentItem="all-projects" />}
          titleClassName="cur-view-path sys-user-nav tab-nav-container mb-4"
        >
          <ProjectsTable
            columns={[
              { name: '', key: 'icon', width: 44, isFixed: true },
              { name: gettext('Name'), key: 'name', width: 0.18 },
              { name: 'ID', key: 'uuid', width: 0.32 },
              { name: 'Owner', key: 'owner', width: 0.25, link_to: false },
              { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
              { name: '', key: 'placeholder', width: 0.1 },
              { name: '', key: 'op', width: 44, isFixed: true }
            ]}
            api={(page, perPage) => sysAdminAPI.sysAdminListAllProjects(page, perPage)}
            onDelete={(project) => sysAdminAPI.sysAdminDeleteProject(project.uuid)}
          />
        </Main>
      </>
    );
  }
}

AllProjects.propTypes = {
  onCloseSidePanel: PropTypes.func,
};

export default AllProjects;
