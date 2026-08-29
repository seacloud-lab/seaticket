import React, { useCallback, useRef } from 'react';
import { toaster, ProjectsTable } from '@/components';
import { orgID, gettext, trashCleanExpireDays } from '@/constants';
import { Utils } from '@/utils/utils';
import orgAdminAPI from '../api';
import CommonOperationConfirmationDialog from '@/components/dialog/common-operation-confirmation-dialog';

const TrashProjects = ({ isShowTrashEmptyConfirmDialog, onTrashEmptyConfirmDialogToggle }) => {
  const ref = useRef(null);

  const onClear = useCallback(() => {
    orgAdminAPI.orgAdminCleanTrashProjects(orgID).then((res) => {
      ref.current.reset();
      const msg = gettext('Trash cleaned');
      toaster.success(msg);
    }).catch((error) => {
      let errMsg = Utils.getErrorMsg(error, true);
      if (!error.response || error.response.status !== 403) {
        toaster.danger(errMsg);
      }
    });
  }, [ref]);

  return (
    <>
      <ProjectsTable
        placeholder={gettext('No deleted projects')}
        ref={ref}
        columns={[
          { name: '', key: 'icon', width: 44, isFixed: true },
          { name: gettext('Name'), key: 'name', width: 0.16 },
          { name: 'ID', key: 'uuid', width: 0.28 },
          { name: gettext('Owner'), key: 'owner', width: 0.2 },
          { name: gettext('Issues'), key: 'issues_count', width: 0.1 },
          { name: gettext('Storage'), key: 'storage_usage', type: 'storage', width: 0.1 },
          { name: gettext('Deleted at'), key: 'delete_time', type: 'date', width: 0.16 },
          { name: '', key: 'op', width: 44, isFixed: true }
        ]}
        api={(page, perPage) => orgAdminAPI.orgAdminListTrashProjects(orgID, page, perPage)}
        onRestore={(project) => orgAdminAPI.orgAdminRestoreTrashProject(orgID, project.id, project.owner_deleted)}
      >
        <p className="mt-4 text-secondary">
          {gettext('Tip: projects deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
        </p>
      </ProjectsTable>
      {isShowTrashEmptyConfirmDialog && (
        <CommonOperationConfirmationDialog
          title={gettext('Clean')}
          message={gettext('Are you sure to clean the trash?')}
          executeOperation={onClear}
          confirmBtnText={gettext('Clean')}
          toggleDialog={onTrashEmptyConfirmDialogToggle}
        />
      )}
    </>
  );
};

export default TrashProjects;
