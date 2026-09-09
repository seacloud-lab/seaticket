import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { ProjectsTable } from '@/components';
import { gettext } from '@/constants';
import orgAdminAPI from '../api';
import GroupNav from '../group-nav';
import { Main, TopBar } from '../main-panel';

const { orgID } = window.org.pageOptions;

const GroupProjects = ({ onCloseSidePanel, groupID }) => {
  const api = useCallback(() => {
    return orgAdminAPI.orgAdminListGroupProjects(orgID, groupID);
  }, [groupID]);

  const onDelete = useCallback((project) => {
    return orgAdminAPI.orgAdminDeleteProjectFromGroup(orgID, groupID, project.uuid);
  }, [groupID]);

  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel} />
      <Main
        title={<GroupNav groupID={groupID} currentItem="projects" />}
        titleClassName="pl-0"
      >
        <ProjectsTable
          columns={[
            { name: '', key: 'icon', width: 44, isFixed: true },
            { name: gettext('Name'), key: 'name', width: 0.18 },
            { name: 'ID', key: 'uuid', width: 0.32 },
            { name: gettext('Owner'), key: 'owner', width: 0.25 },
            { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
            { name: '', key: 'placeholder', width: 0.1 },
            { name: '', key: 'op', width: 44, isFixed: true }
          ]}
          showPaginator={false}
          api={api}
          onDelete={onDelete}
        />
      </Main>
    </>
  );

};

GroupProjects.propTypes = {
  groupID: PropTypes.string,
  onCloseSidePanel: PropTypes.func
};

export default GroupProjects;
