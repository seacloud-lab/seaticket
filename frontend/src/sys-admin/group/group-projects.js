import React, { useCallback, useState } from 'react';
import { ProjectsTable } from '@/components';
import { gettext } from '@/constants';
import sysAdminAPI from '../api';
import { TopBar, Main } from '../main-panel';
import GroupNav from './group-nav';
import GroupTitle from './group-title';

const GroupProjects = ({ onCloseSidePanel, groupID }) => {
  const [groupName, setGroupName] = useState('');

  const api = useCallback(() => {
    return sysAdminAPI.sysAdminListGroupProjects(groupID).then(res => {
      setGroupName(res.data.group_name);
      return {
        data: {
          projects: res.data.projects
        }
      };
    });
  }, [groupID]);

  return (
    <>
      <TopBar onCloseSidePanel={onCloseSidePanel}/>
      <Main title={<GroupTitle groupName={groupName} />} >
        <GroupNav groupID={groupID} currentItem="projects" />
        <ProjectsTable
          columns={[
            { name: '', key: 'icon', width: 44, isFixed: true },
            { name: gettext('Name'), key: 'name', width: 0.18 },
            { name: 'ID', key: 'uuid', width: 0.32 },
            { name: gettext('Owner'), key: 'owner', width: 0.25, link_to: false },
            { name: gettext('Created at'), key: 'created_at', type: 'date', width: 0.15 },
            { name: '', key: 'placeholder', width: 0.1 },
            { name: '', key: 'op', width: 44, isFixed: true }
          ]}
          showPaginator={false}
          api={api}
          onDelete={(project) => sysAdminAPI.sysAdminDeleteProjectsFromGroup(groupID, project.uuid)}
        />
      </Main>
    </>
  );
};

export default GroupProjects;
