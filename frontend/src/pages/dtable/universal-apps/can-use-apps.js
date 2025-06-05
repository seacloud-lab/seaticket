import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { DTableEmptyTip } from 'dtable-ui-component';
import AppItem from './app-item';
import AppFolder from './app-folder';
import { emptyCanUseAppImageSrc, CAN_USED_APP_FOLDER, CAN_USE_APPS } from './constants';
import { Dropdown, DropdownToggle, DropdownItem, DropdownMenu } from 'reactstrap';
import { gettext } from '../../../utils/constants';

function CanUseApps(props) {
  const [isShowDropdownMenu, setIsShowDropdownMenu] = useState(false);
  const { apps, leaveApp, onDeleteFolder, onRenameFolder, onToggleCurrentFolderDialog, onToggleCurrentFolderView, onMoveAppToFolder, onToggleAddFolderDialog, canUsedAppFolders, getAppItemClassAndStyle } = props;

  function toggleDropdownMenu() {
    setIsShowDropdownMenu(!isShowDropdownMenu);
  }

  function toggleAddFolderDialog() {
    onToggleAddFolderDialog(CAN_USED_APP_FOLDER);
  }
  const appsCount = apps.length;
  const foldersCount = canUsedAppFolders.length;
  const total = appsCount + foldersCount;
  return (
    <div className="app-group-container">
      <div className="app-group-name">
        <span className="text-truncate">{gettext('Apps I can use')}</span>
        <Dropdown isOpen={isShowDropdownMenu} toggle={toggleDropdownMenu} className="apps-dropdown">
          <DropdownToggle
            tag="i"
            role="button"
            className="toggle-icon dtable-font dtable-icon-down3"
            data-toggle="dropdown"
            aria-expanded={isShowDropdownMenu}
            title={gettext('More operations')}
            aria-label={gettext('More operations')}
            aria-haspopup={true}
          />
          <DropdownMenu>
            <DropdownItem className="create-app-folder-item" onClick={toggleAddFolderDialog}>
              <span aria-hidden="true">
                <i className="item-icon dtable-font dtable-icon-folders" />
              </span>
              <span>{gettext('Create a folder')}</span>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
      {total === 0 ?
        <DTableEmptyTip text={gettext('No app you have joined yet')} src={emptyCanUseAppImageSrc} />
        :
        <div className="app-group-content d-flex">
          {canUsedAppFolders.map((folder, index) => {
            const { className, style } = getAppItemClassAndStyle(index, total);
            const { id } = folder;
            return (
              <AppFolder
                key={`app-item-${id}`}
                style={style}
                className={className}
                folderItem={folder}
                folderType={CAN_USED_APP_FOLDER}
                onDeleteFolder={onDeleteFolder}
                onRenameFolder={onRenameFolder}
                onToggleCurrentFolderView={onToggleCurrentFolderView}
                onToggleCurrentFolderDialog={onToggleCurrentFolderDialog}
              />
            );
          })
          }
          {apps.map((appItem, index) => {
            const { app_id } = appItem;
            const { style, className } = props.getAppItemClassAndStyle(index + foldersCount, total);
            return (
              <AppItem
                key={`app-item-${app_id}`}
                style={style}
                className={className}
                appItem={appItem}
                isAdmin={false}
                leaveApp={leaveApp}
                folders={canUsedAppFolders}
                onMoveAppToFolder={onMoveAppToFolder.bind(this, CAN_USE_APPS)}
              />
            );
          })}
        </div>
      }
    </div>
  );
}

CanUseApps.propTypes = {
  apps: PropTypes.array,
  leaveApp: PropTypes.func,
  getAppItemClassAndStyle: PropTypes.func,
  canUsedAppFolders: PropTypes.array,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderView: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
  onMoveAppToFolder: PropTypes.func,
};

export default CanUseApps;
