import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import MobileCommonHeader from '../mobile/mobile-common-header';
import UniversalApp from './model/universal-app';
import AppItem from './app-item';
import { Utils } from '../../../utils/utils';
import { MANAGED_APP_FOLDER } from './constants';

function AppFolderView(props) {
  const { currentFolder, onToggleCurrentFolderView } = props;
  const [appsInFolder, setAppsInFolder] = useState([]);
  const { folder_type: folderType } = currentFolder;
  const isAdmin = folderType === MANAGED_APP_FOLDER ? true : false;

  useEffect(() => {
    if (currentFolder) {
      const { id } = currentFolder;
      dtableWebAPI.getAppFolderContent(id).then((res) => {
        const { app_list } = res.data;
        const appsInFolder = Array.isArray(app_list) ? app_list.map(app => {
          app.folder_id = id;
          return new UniversalApp(app);
        }) : [];
        setAppsInFolder(appsInFolder);
      }).catch((err) => {
        const errMessage = Utils.getErrorMsg(err);
        toaster.danger(errMessage);
      });
    }
  }, []);

  function leaveApp(appItem) {
    // const { token } = appItem;
    dtableWebAPI.leaveApp(appItem.app_user_id).then(res => {
      let newAppsInFolder = appsInFolder.slice(0);
      const appItemIndex = newAppsInFolder.findIndex(app => app.app_uuid === appItem.app_uuid);
      if (appItemIndex !== -1) {
        newAppsInFolder.splice(appItemIndex, 1);
      }
      setAppsInFolder(newAppsInFolder);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  return (
    <div className="add-blank-table dtable-folder-view">
      <MobileCommonHeader
        title={currentFolder.name}
        leftName={<i className="dtable-font dtable-icon-return"></i>}
        onLeftClick={onToggleCurrentFolderView}
      />
      <div className='folder'>
        <div className='folder-items table-mobile-item-container'>
          {appsInFolder.map((app, index) => {
            const { app_id } = app;
            return (
              <AppItem
                index={index}
                key={app_id}
                isAdmin={isAdmin}
                isInMobileFolder={true}
                appItem={app}
                leaveApp={leaveApp}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

AppFolderView.propTypes = {
  apps: PropTypes.array,
  currentFolder: PropTypes.object,
  onToggleCurrentFolderView: PropTypes.func,
  refreshPendingtasksCount: PropTypes.func,
};

export default AppFolderView;
