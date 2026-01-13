import React, { useCallback, useRef, useState } from 'react';
import { Button, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import homeAPI from '../../../api';
import { Utils } from '@/utils/utils';
import { AdminProjects, CommonOperationConfirmationDialog, toaster } from '@/components';
import { gettext, trashCleanExpireDays } from '@/constants';

import './index.css';

const MyProjectsTrash = () => {
  const [activeTab, setActiveTab] = useState('personal');
  const [isShowCleanConfirm, setIsShowCleanConfirm] = useState(false);

  const projectsRef = useRef(null);

  const listTrashProjects = useCallback(() => {
    return homeAPI.listTrashProjects().then(res => {
      const { trash_project_list, count } = res?.data || {};
      return { data: { projects: trash_project_list, count } };
    });
  });

  const listManagedGroupTrashProjects = useCallback(() => {
    return homeAPI.listGroups(false, true).then(groupsRes => {
      const groups = groupsRes?.data || [];
      const requests = groups.map(g => homeAPI.listGroupTrashProjects(g.id));
      return Promise.all(requests).then(resArr => {
        let items = [];
        resArr.forEach((resp, idx) => {
          const groupID = groups[idx]?.id;
          const groupName = groups[idx]?.name;
          const list = resp?.data?.trash_project_list || [];
          list.forEach(item => {
            items.push({ ...item, group_id: groupID, owner: groupName });
          });
        });
        return { data: { projects: items, count: items.length } };
      });
    });
  });

  const handleClean = useCallback(() => {
    homeAPI.cleanTrashProjects().then(res => {
      projectsRef.current.reset();
    }).catch(error => {
      const errorMsg = Utils.getErrorMsg(error);
      toaster.danger(errorMsg);
    });
  }, []);

  const openCleanConfirm = useCallback(() => {
    const { projects } = projectsRef.current.getData();
    if (projects.length === 0) return;
    setIsShowCleanConfirm(true);
  }, []);

  const isDesktop = Utils.isDesktop();

  return (
    <>
      <div className="main-panel-center project-center">
        <div className="cur-view-container d-flex flex-1 flex-column">
          <div className={`${isDesktop ? '' : 'p-0'} cur-view-content my-projects-trash`}>
            <div className="my-projects-trash-title">
              <span className="my-projects-trash-title-text">{gettext('Trash')}</span>
              {activeTab === 'personal' && (
                <Button onClick={openCleanConfirm}>
                  {gettext('Clean')}
                </Button>
              )}
            </div>
            <Nav tabs className="mt-2">
              <NavItem>
                <NavLink className={activeTab === 'personal' ? 'active' : ''} onClick={() => setActiveTab('personal')}>
                  {gettext('Personal')}
                </NavLink>
              </NavItem>
              <NavItem>
                <NavLink className={activeTab === 'groups' ? 'active' : ''} onClick={() => setActiveTab('groups')}>
                  {gettext('Groups I manage')}
                </NavLink>
              </NavItem>
            </Nav>
            <TabContent activeTab={activeTab} className="pt-3">
              <TabPane tabId="personal">
                <AdminProjects
                  ref={projectsRef}
                  showPaginator={false}
                  placeholder={gettext('No deleted projects')}
                  columns={[
                    { name: '', key: 'icon', width: 44, isFixed: true },
                    { name: gettext('Name'), key: 'name', width: 0.5 },
                    { name: gettext('Deleted at'), key: 'delete_time', type: 'date', width: 0.4 },
                    { name: '', key: 'placeholder', width: 0.1 },
                    { name: '', key: 'op', width: 44, isFixed: true }
                  ]}
                  api={listTrashProjects}
                  onRestore={(project) => homeAPI.restoreTrashProject(project.uuid)}
                >
                  <p className="mt-4 seatable-tip-default text-secondary">
                    {gettext('Note: Projects are removed from trash {expireDays} days after their deletion. Once removed from trash, they cannot be recovered from trash.').replace('{expireDays}', trashCleanExpireDays)}
                  </p>
                </AdminProjects>
              </TabPane>
              <TabPane tabId="groups">
                <AdminProjects
                  showPaginator={false}
                  placeholder={gettext('No deleted projects')}
                  columns={[
                    { name: '', key: 'icon', width: 44, isFixed: true },
                    { name: gettext('Name'), key: 'name', width: 0.5 },
                    { name: gettext('Deleted at'), key: 'delete_time', type: 'date', width: 0.4 },
                    { name: '', key: 'placeholder', width: 0.1 },
                    { name: '', key: 'op', width: 44, isFixed: true }
                  ]}
                  api={listManagedGroupTrashProjects}
                  onRestore={(project) => homeAPI.restoreGroupTrashProject(project.uuid, project.group_id)}
                >
                  <p className="mt-4 seatable-tip-default text-secondary">
                    {gettext('Note: Projects deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
                  </p>
                </AdminProjects>
              </TabPane>
            </TabContent>
          </div>
        </div>
      </div>
      {isShowCleanConfirm && (
        <CommonOperationConfirmationDialog
          title={gettext('Clean')}
          message={gettext('Are you sure to clean the trash?')}
          executeOperation={handleClean}
          confirmBtnText={gettext('Clean')}
          toggleDialog={() => setIsShowCleanConfirm(false)}
        />
      )}
    </>
  );
};

export default MyProjectsTrash;
