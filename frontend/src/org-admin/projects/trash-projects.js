import React, { useCallback, useRef } from 'react';
import { toaster, AdminProjects, ClearTrashDialog } from '@/components';
import { orgID, gettext, trashCleanExpireDays } from '@/constants';
import { Utils } from '@/utils/utils';
import orgAdminAPI from '../api';

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
      <AdminProjects
        placeholder={gettext('No deleted projects')}
        ref={ref}
        columns={[
          { name: '', key: 'icon', width: 44, isFixed: true },
          { name: gettext('Name'), key: 'name', width: 0.18 },
          { name: 'ID', key: 'uuid', width: 0.32 },
          { name: 'Owner', key: 'owner', width: 0.25 },
          { name: gettext('Deleted at'), key: 'delete_time', type: 'date', width: 0.15 },
          { name: '', key: 'placeholder', width: 0.1 },
          { name: '', key: 'op', width: 44, isFixed: true }
        ]}
        api={(page, perPage) => orgAdminAPI.orgAdminListTrashProjects(orgID, page, perPage)}
        onRestore={(project) => orgAdminAPI.orgAdminRestoreTrashProject(orgID, project.id, project.owner_deleted)}
      >
        <p className="mt-4 text-secondary">
          {gettext('Tip: projects deleted {expireDays} days ago will be cleaned automatically.').replace('{expireDays}', trashCleanExpireDays)}
        </p>
      </AdminProjects>
      {isShowTrashEmptyConfirmDialog && (
        <ClearTrashDialog
          onToggle={onTrashEmptyConfirmDialogToggle}
          onClear={onClear}
        />
      )}
    </>
  );
};

export default TrashProjects;
