import React, { useCallback, useRef, useState } from 'react';
import { navigate } from '@gatsbyjs/reach-router';
import { Button } from 'reactstrap';
import { toaster } from '@/components';
import { Utils } from '@/utils/utils';
import { siteRoot, gettext } from '@/constants';
import SysAdminCreateGroupDialog from '@/sys-admin/dialog/sysadmin-create-group-dialog';
import sysAdminAPI from '@/sys-admin/api';
import { TopBar, Main } from '../main-panel';
import GroupsTable from './groups-table';
import { EnterSearchInput } from '@/components';
import { downloadFile } from '@/utils/download';

const Groups = ({ onCloseSidePanel }) => {
  const [isShowCreateGroupDialog, setIsShowCreateGroupDialog] = useState(false);

  const groupsTableRef = useRef(null);

  const openCreateGroupDialog = useCallback(() => {
    setIsShowCreateGroupDialog(true);
  }, []);

  const closeCreateGroupDialog = useCallback(() => {
    setIsShowCreateGroupDialog(false);
  }, []);

  const createGroup = useCallback((groupName, ownerEmail) => {
    sysAdminAPI.sysAdminCreateNewGroup(groupName, ownerEmail).then(res => {
      groupsTableRef.current.addGroups([res.data]);
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }, [groupsTableRef]);

  const downloadGroupExcel = useCallback(() => {
    downloadFile(`${siteRoot}sys/groups/export-excel/`);
  }, []);

  const searchItems = useCallback((keyword) => {
    navigate(`${siteRoot}sys/search-groups/?query=${encodeURIComponent(keyword)}`);
  }, []);

  const isDesktop = Utils.isDesktop();
  return (
    <>
      <TopBar
        onCloseSidePanel={onCloseSidePanel}
        search={(<EnterSearchInput placeholder={gettext('Search groups by name')} onSubmit={searchItems} />)}
      >
        {isDesktop ? (
          <>
            <Button color="secondary" className="operation-item" onClick={openCreateGroupDialog}>{gettext('New group')}</Button>
            <Button color="secondary" className="operation-item" onClick={downloadGroupExcel}>{gettext('Export Excel')}</Button>
          </>
        ) : (
          <>
            <span className="mobile-dropdown-item dropdown-item" onClick={openCreateGroupDialog}>{gettext('New group')}</span>
            <span className="mobile-dropdown-item dropdown-item" onClick={downloadGroupExcel}>{gettext('Export Excel')}</span>
          </>
        )}
      </TopBar>
      <Main title={gettext('Groups')}>
        <GroupsTable
          ref={groupsTableRef}
          columns={[
            { name: gettext('Name'), key: 'name', width: 0.2 },
            { name: gettext('Owner'), key: 'owner', width: 0.2 },
            { name: '', key: 'placeholder', width: 0.4 },
            { name: gettext('Created at'), key: 'created_at', width: 0.2 },
            { name: '', key: 'op', width: 44, isFixed: true }
          ]}
          api={(page, perPage) => sysAdminAPI.sysAdminListAllGroups(page, perPage)}
          onDelete={(group) => sysAdminAPI.sysAdminDismissGroupByID(group.id)}
          onTransfer={(group, userEmail) => sysAdminAPI.sysAdminTransferGroup(userEmail, group.id)}
        />
      </Main>
      {isShowCreateGroupDialog && (
        <SysAdminCreateGroupDialog createGroup={createGroup} toggleDialog={closeCreateGroupDialog} />
      )}
    </>
  );
};

export default Groups;
