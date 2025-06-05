import React, { Component, } from 'react';
import { toaster } from 'dtable-ui-component';
import { Utils } from '../../utils/utils';
import Loading from '../../components/loading';
import { gettext, universalAppCNHelpLink, lang } from '../../utils/constants';
import { dtableWebAPI } from '../../api/dtable-web-api';
import UniversalApp from './universal-apps/model/universal-app';
import CanUseApps from './universal-apps/can-use-apps';
import MyManagedApps from './universal-apps/my-managed-apps';
import AddFolderDialog from './dialog/add-folder-dialog';
import AppFolderDialog from './universal-apps/app-folder-dialog';
import AppFolderView from './universal-apps/app-folder-view';
import { MANAGED_APP_FOLDER, CAN_USED_APP_FOLDER, MY_MANAGED_APPS } from './universal-apps/constants';
import './css/forms.css';
import '../../css/dtable-apps-panel.css';

const isDesktop = Utils.isDesktop();
const APP_ITEM_WIDTH = 168;

class MainPanelUniversalApps extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isAppListLoading: true,
      appList: [],
      myManagedApps: [],
      canUseApps: [],
      numberOfAppsPerRow: 1,
      appItemWidth: 168,
      managedAppFolders: [],
      canUsedAppFolders: [],
      currentFolder: null,
      isShowAddFolderDialog: false,
      isShowAppFolderDialog: false,
      isShowAppFolderView: false,
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.onResize);
    dtableWebAPI.listUserApps().then(res => {
      const { my_managed_apps, can_use_apps, app_folders } = res.data;
      let myManagedApps = Array.isArray(my_managed_apps) ? my_managed_apps.map(app => new UniversalApp(app)) : [];
      let canUseApps = Array.isArray(can_use_apps) ? can_use_apps.map(app => new UniversalApp(app)) : [];
      const managedAppFolders = Array.isArray(app_folders) ? app_folders.filter(folder => folder.folder_type === MANAGED_APP_FOLDER) : [];
      const canUsedAppFolders = Array.isArray(app_folders) ? app_folders.filter(folder => folder.folder_type === CAN_USED_APP_FOLDER) : [];
      this.setState({
        myManagedApps,
        canUseApps,
        isAppListLoading: false,
        managedAppFolders,
        canUsedAppFolders
      }, () => {
        this.onResize();
      });
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      this.setState({
        isAppListLoading: false,
      });
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    // 16: app item margin with or view content padding width
    // 184: app min-width[168] and margin right[16]
    // 352: two appItem min-width sum[336] + padding[32] + margin right[16]
    // 536: three appItem min-width sum[504] + padding[32] + two margin right[32]
    if (!this.curViewContent) return;
    const { clientWidth, offsetWidth } = this.curViewContent;
    if (!isDesktop) {
      const contentWidth = clientWidth - 16 * 2;
      let numberOfAppsPerRow = 1;
      let appItemWidth = contentWidth;
      if (contentWidth >= 536) {
        numberOfAppsPerRow = 3;
        // The first and second workflow items margin-right sum is 32
        appItemWidth = (contentWidth - 32) / 3;
      } else if (contentWidth >= 352) {
        numberOfAppsPerRow = 2;
        // The first workflow item margin-right is 16
        appItemWidth = (contentWidth - 16) / 2;
      }
      this.setState({ appItemWidth, numberOfAppsPerRow });
      return;
    }

    const scrollBarWidth = offsetWidth - clientWidth;
    // 0.22: side panel width is 22%, 16: cur-view-content's padding left/right, left margin and right margin is 6px
    const appListWidth = parseInt(window.innerWidth * (1 - 0.22) - 16 * 2 + 16 - scrollBarWidth);
    const numberOfAppsPerRow = Math.floor(appListWidth / 184);
    const remainingWidth = appListWidth % 184;
    let appItemWidth;
    if (remainingWidth > 0) {
      appItemWidth = 168 + remainingWidth / numberOfAppsPerRow;
    } else {
      appItemWidth = 168;
    }
    const margin = Math.floor((12 + remainingWidth / numberOfAppsPerRow) / 2);
    this.setState({
      margin,
      appItemWidth,
      numberOfAppsPerRow,
    });
  };

  getAppItemClassAndStyle = (index, appsCount) => {
    const { appItemWidth, numberOfAppsPerRow } = this.state;

    // 0.22: percentage of side panel; 16: cur-view-content's padding left/right;
    // 168: app item width; 20: app item margin right/bottom
    let allLineAppCount = parseInt(appsCount / numberOfAppsPerRow) * numberOfAppsPerRow;
    if (allLineAppCount === appsCount) {
      allLineAppCount = allLineAppCount - numberOfAppsPerRow;
    }
    let className = '';
    let style = { width: appItemWidth };

    if (isDesktop) {
      const validIndex = index + 1;
      if (validIndex % numberOfAppsPerRow === 0) {
        className += 'mr-0 ';
      }
      if (validIndex > allLineAppCount) {
        className += 'mb-0 ';
      }
      return { className, style };
    }
    if (index > numberOfAppsPerRow - 1) {
      style.marginLeft = index % numberOfAppsPerRow === 0 ? - ((appItemWidth + 16) * numberOfAppsPerRow) : 0;
      style.marginTop = parseInt(index / numberOfAppsPerRow) * 192;
      return { className, style };
    }
    return { className, style };
  };

  getLoadMoreStyle = () => {
    const appClientWidth = this.appContainer.clientWidth;
    const marginLeft = - (appClientWidth + 8);
    const marginTop = 390;
    const style = { marginLeft, marginTop };
    if (isDesktop) {
      return {};
    }
    return style;
  };

  renderCNHelp = () => {
    return (
      <div className="main-panel-app-help d-flex align-items-center" onClick={() => window.open(universalAppCNHelpLink)}>
        <i className="dtable-font dtable-icon-use-help"></i>
        {isDesktop && <span className="ml-2 main-panel-app-help-tip">{gettext('Help')}</span>}
      </div>
    );
  };

  leaveApp = (appItem) => {
    let { canUseApps } = this.state;

    dtableWebAPI.leaveApp(appItem.app_user_id).then(res => {
      if (res.data.success === true) {
        let apps = canUseApps.filter(app =>
          app !== appItem
        );
        this.setState({ canUseApps: apps });
      }
    }).catch((error) => {
      toaster.danger(Utils.getErrorMsg(error));
      this.setState({
        isAppListLoading: false,
      });
    });
  };

  onToggleAddFolderDialog = (folderType) => {
    this.setState({
      folderType,
      isShowAddFolderDialog: !this.state.isShowAddFolderDialog,
    });
  };

  onToggleCurrentFolderDialog = (folderType, folderItem) => {
    this.setState({
      folderType,
      currentFolder: folderItem,
      isShowAppFolderDialog: !this.state.isShowAppFolderDialog,
    });
  };

  onToggleCurrentFolderView = (folderItem) => {
    this.setState({
      currentFolder: folderItem,
      isShowAppFolderView: !this.state.isShowAppFolderView
    });
  };

  onChangeCurrentFolder = (appFolder) => {
    this.setState({ currentFolder: appFolder });
  };

  handlerError = (err) => {
    const errMessage = Utils.getErrorMsg(err);
    toaster.danger(errMessage);
  };

  onAddFolder = async (folderName) => {
    const { folderType } = this.state;
    try {
      const res = await dtableWebAPI.createAppFolder(folderName, folderType);
      const { folder } = res.data;
      if (folderType === MANAGED_APP_FOLDER) {
        const { managedAppFolders } = this.state;
        const updatedFolders = [...managedAppFolders, folder];
        this.setState({ managedAppFolders: updatedFolders });
      } else {
        const { canUsedAppFolders } = this.state;
        const updatedFolders = [...canUsedAppFolders, folder];
        this.setState({ canUsedAppFolders: updatedFolders });
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  onDeleteFolder = async (folderItem) => {
    const { id: folderId, folder_type: folderType } = folderItem;
    try {
      const res = await dtableWebAPI.deleteAppFolder(folderId);
      const { success } = res.data;
      if (success) {
        if (folderType === MANAGED_APP_FOLDER) {
          const { managedAppFolders } = this.state;
          const updatedFolders = managedAppFolders.filter(folder => folder.id !== folderId);
          this.setState({ managedAppFolders: updatedFolders });
        } else {
          const { canUsedAppFolders } = this.state;
          const updatedFolders = canUsedAppFolders.filter(folder => folder.id !== folderId);
          this.setState({ canUsedAppFolders: updatedFolders });
        }
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  onRenameFolder = async (folderItem, newName) => {
    const { id: folderId, folder_type: folderType } = folderItem;
    try {
      const res = await dtableWebAPI.renameAppFolder(newName, folderId);
      const { folder: updatedFolder } = res.data;
      if (folderType === MANAGED_APP_FOLDER) {
        const { managedAppFolders } = this.state;
        const updatedFolders = managedAppFolders.map(folder => {
          return folder.id === updatedFolder.id ? { ...folder, name: updatedFolder.name } : folder;
        });
        this.setState({ managedAppFolders: updatedFolders });
      } else {
        const { canUsedAppFolders } = this.state;
        const updatedFolders = canUsedAppFolders.map(folder => {
          return folder.id === updatedFolder.id ? { ...folder, name: updatedFolder.name } : folder;
        });
        this.setState({ canUsedAppFolders: updatedFolders });
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  updateCanUseApp = (app, folderId) => {
    if (folderId === '/'){
      // to root
      this.setState({
        canUseApps: [...this.state.canUseApps, app],
      });
    }
    else if (app.current_folder === '/'){
      this.setState({
        canUseApps: this.state.canUseApps.filter((existingApp) => existingApp.app_uuid !== app.app_uuid)
      });
    }
  };

  updateManagedApp = (app, folderId) => {
    if (folderId === '/'){
      // to root
      this.setState({
        myManagedApps: [...this.state.myManagedApps, app],
      });
    }
    else if (app.current_folder === '/'){
      this.setState({
        myManagedApps: this.state.myManagedApps.filter((existingApp) => existingApp.app_uuid !== app.app_uuid)
      });
    }
  };

  onMoveAppToFolder = async (type, app, folderId) => {
    const sourceFolderId = app.current_folder;
    const targetFolderId = folderId;
    try {
      const res = await dtableWebAPI.moveAppToFolder(app.app_uuid, sourceFolderId, targetFolderId);
      const { success } = res.data;
      if (success) {
        if (type === MANAGED_APP_FOLDER || type === MY_MANAGED_APPS) {
          this.updateManagedApp(app, targetFolderId);
        } else {
          this.updateCanUseApp(app, targetFolderId);
        }
      }
    } catch (err) {
      this.handlerError(err);
    }
  };

  renderAppDialog = () => {
    const { folderType, currentFolder, myManagedApps, canUseApps, managedAppFolders, canUsedAppFolders } = this.state;
    let apps;
    let folders;
    let isAdmin;
    let onMoveAppToFolder;
    if (folderType === MANAGED_APP_FOLDER) {
      apps = myManagedApps;
      folders = managedAppFolders;
      onMoveAppToFolder = this.onMoveAppToFolder;
      isAdmin = true;
    } else {
      apps = canUseApps;
      folders = canUsedAppFolders;
      onMoveAppToFolder = this.onMoveAppToFolder;
      isAdmin = false;
    }
    return (
      <AppFolderDialog
        currentFolder={currentFolder}
        apps={apps}
        folders={folders}
        folderType={folderType}
        isAdmin={isAdmin}
        appItemWidth={APP_ITEM_WIDTH}
        onAddFolder={this.onAddFolder}
        onRenameFolder={this.onRenameFolder}
        onDeleteFolder={this.onDeleteFolder}
        onMoveAppToFolder={onMoveAppToFolder}
        onChangeCurrentFolder={this.onChangeCurrentFolder}
        leaveApp={this.leaveApp}
        onToggleAddFolderDialog={this.onToggleAddFolderDialog}
        onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
      />
    );
  };

  render() {
    let { canUseApps, myManagedApps, isAppListLoading, numberOfAppsPerRow, currentFolder,
      isShowAddFolderDialog, isShowAppFolderDialog, isShowAppFolderView, managedAppFolders, canUsedAppFolders } = this.state;
    return (
      <div className={`main-panel-center main-panel-app ${isDesktop ? '' : 'mobile-main-panel-app'}`}>
        <div className="cur-view-container">
          <div className="cur-view-content" ref={ref => this.curViewContent = ref}>
            <div ref={ref => this.appContainer = ref}>
              <div className="main-panel-app-header d-flex align-items-center">
                <div className="main-panel-app-title">{gettext('Apps')}</div>
                {lang === 'zh-cn' && universalAppCNHelpLink && this.renderCNHelp()}
              </div>
              <div className="main-panel-my-apps">
                {isAppListLoading ?
                  <Loading /> :
                  <>
                    <MyManagedApps
                      apps={myManagedApps}
                      numberOfAppsShown={isDesktop ? numberOfAppsPerRow : 2 * numberOfAppsPerRow}
                      getAppItemClassAndStyle={this.getAppItemClassAndStyle}
                      managedAppFolders={managedAppFolders}
                      onResize={this.onResize}
                      getLoadMoreStyle={this.getLoadMoreStyle}
                      onDeleteFolder={this.onDeleteFolder}
                      onRenameFolder={this.onRenameFolder}
                      onToggleAddFolderDialog={this.onToggleAddFolderDialog}
                      onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
                      onToggleCurrentFolderView={this.onToggleCurrentFolderView}
                      onMoveAppToFolder={this.onMoveAppToFolder}
                    />
                    <CanUseApps
                      apps={canUseApps}
                      getAppItemClassAndStyle={this.getAppItemClassAndStyle}
                      leaveApp={this.leaveApp}
                      canUsedAppFolders={canUsedAppFolders}
                      onDeleteFolder={this.onDeleteFolder}
                      onRenameFolder={this.onRenameFolder}
                      onToggleAddFolderDialog={this.onToggleAddFolderDialog}
                      onToggleCurrentFolderDialog={this.onToggleCurrentFolderDialog}
                      onToggleCurrentFolderView={this.onToggleCurrentFolderView}
                      onMoveAppToFolder={this.onMoveAppToFolder}
                    />
                  </>
                }
              </div>
            </div>
          </div>
        </div>
        {isShowAddFolderDialog && (
          <AddFolderDialog
            folderType={this.state.folderType}
            onAddFolder={this.onAddFolder}
            onToggleAddFolderDialog={this.onToggleAddFolderDialog}
          />
        )}
        {isShowAppFolderDialog && (
          this.renderAppDialog()
        )}
        {isShowAppFolderView &&
          <AppFolderView
            currentFolder={currentFolder}
            onToggleCurrentFolderView={this.onToggleCurrentFolderView}
            refreshPendingtasksCount={this.refreshPendingtasksCount}
          />
        }
      </div>
    );
  }
}

export default MainPanelUniversalApps;
