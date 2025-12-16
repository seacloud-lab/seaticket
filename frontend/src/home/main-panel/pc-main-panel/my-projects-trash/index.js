import React, { useCallback, useRef, useState } from 'react';
import { Button } from 'reactstrap';
import homeAPI from '../../../api';
import { Utils } from '@/utils/utils';
import { AdminProjects, CommonOperationConfirmationDialog, toaster } from '@/components';
import { gettext, trashCleanExpireDays } from '@/constants';

import './index.css';

const MyProjectsTrash = () => {
  const [isShowCleanConfirm, setIsShowCleanConfirm] = useState(false);

  const projectsRef = useRef(null);

  const listTrashProjects = useCallback(() => {
    return homeAPI.listTrashProjects().then(res => {
      const { trash_project_list, count } = res?.data || {};
      return { data: { projects: trash_project_list, count } };
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

  const isDesktop = Utils.isDesktop();

  return (
    <>
      <div className="main-panel-center project-center">
        <div className="cur-view-container d-flex flex-1 flex-column">
          <div className={`${isDesktop ? '' : 'p-0'} cur-view-content my-projects-trash`}>
            <div className="my-projects-trash-title">
              <span className="my-projects-trash-title-text">{gettext('Trash')}</span>
              <Button onClick={() => setIsShowCleanConfirm(true)}>
                {gettext('Clean')}
              </Button>
            </div>
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
