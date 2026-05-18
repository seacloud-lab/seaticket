import React, { Component, Fragment } from 'react';
import { ProjectsTable } from '@/components';
import sysAdminAPI from '@/sys-admin/api';
import { gettext, trashCleanExpireDays } from '@/constants';
import ProjectNav from './project-nav';
import { TopBar, Main } from '../main-panel';

class TrashProjects extends Component {

  render() {
    return (
      <>
        <TopBar onCloseSidePanel={this.props.onCloseSidePanel} />
        <Main
          title={<ProjectNav currentItem="trash-projects"/>}
          titleClassName="cur-view-path sys-user-nav tab-nav-container mb-4"
        >
          <ProjectsTable
            placeholder={gettext('No deleted projects')}
            columns={[
              { name: '', key: 'icon', width: 44, isFixed: true },
              { name: gettext('Name'), key: 'name', width: 0.18 },
              { name: 'ID', key: 'uuid', width: 0.32 },
              { name: 'Owner', key: 'owner', width: 0.25, link_to: false },
              { name: gettext('Deleted at'), key: 'delete_time', type: 'date', width: 0.15 },
              { name: '', key: 'placeholder', width: 0.1 },
              { name: '', key: 'op', width: 44, isFixed: true }
            ]}
            api={(page, perPage) => sysAdminAPI.sysAdminListTrashProjects(page, perPage)}
            onRestore={(project) => sysAdminAPI.sysAdminRestoreTrashProject(project.id, project.owner_deleted)}
          >
            <p className="mt-4 seaqa-tip-default text-secondary">
              {gettext('Note: Projects are removed from trash {expireDays} days after their deletion. Once removed from trash, they cannot be recovered from trash.').replace('{expireDays}', trashCleanExpireDays)}
            </p>
          </ProjectsTable>
        </Main>
      </>
    );
  }
}

export default TrashProjects;
