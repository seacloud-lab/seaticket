import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { toaster, DTableEmptyTip, DTableModalHeader } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import AppFolders from './sidebar/app-folders';
import AppFolderPath from '../app-folder-path';
import AppItem from '../app-item';
import AppFolder from '../app-folder';
import UniversalApp from '../model/universal-app';
import { emptyAppImageSrc, MANAGED_APP_FOLDER } from '../constants';
import { folderImageSrc } from '../../../../constants/image-source-constants';
import { Utils } from '../../../../utils/utils';
import { gettext } from '../../../../utils/constants';

import './index.css';

const propTypes = {
  currentFolder: PropTypes.object,
  apps: PropTypes.array,
  folders: PropTypes.array,
  folderType: PropTypes.string,
  isAdmin: PropTypes.bool,
  appItemWidth: PropTypes.number,
  onAddFolder: PropTypes.func,
  onRenameFolder: PropTypes.func,
  onDeleteFolder: PropTypes.func,
  onMoveAppToFolder: PropTypes.func,
  onChangeCurrentFolder: PropTypes.func,
  onToggleAddFolderDialog: PropTypes.func,
  onToggleCurrentFolderDialog: PropTypes.func,
  leaveApp: PropTypes.func
};

class AppFolderDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = { appsInFolder: [] };
  }

  componentDidMount() {
    this.initApps();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.apps !== this.props.apps ||
      prevProps.currentFolder !== this.props.currentFolder
    ) {
      this.initApps();
    }
  }

  initApps = () => {
    const { currentFolder } = this.props;
    if (currentFolder) {
      const { id } = currentFolder;
      dtableWebAPI.getAppFolderContent(id).then((res) => {
        const { app_list } = res.data;
        const appsInFolder = Array.isArray(app_list) ? app_list.map(app => {
          app.folder_id = id;
          return new UniversalApp(app);
        }) : [];
        this.setState({ appsInFolder, folderList: [] });
      }).catch((err) => {
        const errMessage = Utils.getErrorMsg(err);
        toaster.danger(errMessage);
      });
    }
  };

  toggle = () => {
    this.props.onToggleCurrentFolderDialog(null, null);
  };

  getTargetFolders = () => {
    const { currentFolder, folders } = this.props;
    if (!currentFolder) {
      return folders;
    }
    return folders.filter(folder => folder.id !== currentFolder.id) || [];
  };

  isEmptyFolder = () => {
    const { currentFolder, apps, folders } = this.props;
    const { appsInFolder } = this.state;
    if (!currentFolder) {
      return (apps.length === 0 && folders.length === 0) ? true : false;
    }
    return appsInFolder.length === 0 ? true : false;
  };

  onMoveAppToFolder = (app, forderId) => {
    this.props.onMoveAppToFolder(this.props.folderType, app, forderId);
    // update appsInFolder if not related root dir
    if (app.current_folder !== '/' && forderId !== '/'){
      this.setState({
        appsInFolder: this.state.appsInFolder.filter((existingApp) => existingApp.app_uuid !== app.app_uuid)
      });
    }
  };

  render() {
    const { currentFolder, apps, folders, folderType, isAdmin } = this.props;
    let { appsInFolder } = this.state;
    const title = folderType === MANAGED_APP_FOLDER ? gettext('My managed apps') : gettext('Apps I can use');
    if (currentFolder === null) {
      appsInFolder = apps;
    }
    const style = { width: this.props.appItemWidth };
    return (
      <Modal
        className="app-folder-dialog"
        isOpen={true}
        toggle={this.toggle}
        zIndex={100}
      >
        <DTableModalHeader toggle={this.toggle}>
          <div className="modal-folder-title">
            <img src={folderImageSrc} height="24px" alt='' />
            <span className="ml-2">
              {(currentFolder && currentFolder.name) || title}
            </span>
          </div>
        </DTableModalHeader>
        <ModalBody className="d-flex p-0">
          <AppFolders
            currentFolder={currentFolder}
            folders={folders}
            title={title}
            onAddFolder={this.props.onAddFolder}
            onDeleteFolder={this.props.onDeleteFolder}
            onRenameFolder={this.props.onRenameFolder}
            onChangeCurrentFolder={this.props.onChangeCurrentFolder}
          />
          <div className="folder-dialog-right-section" ref={ref => this.rightSectionRef = ref}>
            <AppFolderPath
              title={title}
              folder={this.props.currentFolder}
              onChangeCurrentFolder={this.props.onChangeCurrentFolder}
            />
            <div className="app-group-container" style={{ maxHeight: (window.innerHeight - 200) + 'px' }}>
              {this.isEmptyFolder() && (
                <DTableEmptyTip text={gettext('No app have been added yet')} src={emptyAppImageSrc} />
              )}
              <div className="app-group-content d-flex">
                {!currentFolder && folders.map((folder) => {
                  const { id } = folder;
                  return (
                    <AppFolder
                      key={`app-folder-${id}`}
                      style={style}
                      folderItem={folder}
                      isOpenFolderDialog={true}
                      onChangeCurrentFolder={this.props.onChangeCurrentFolder}
                      onDeleteFolder={this.props.onDeleteFolder}
                      onRenameFolder={this.props.onRenameFolder}
                      onToggleCurrentFolderDialog={this.props.onToggleCurrentFolderDialog}
                    />
                  );
                })}
                {appsInFolder.map((appItem) => {
                  const { app_id } = appItem;
                  return (
                    <AppItem
                      key={`app-${app_id}`}
                      style={style}
                      appItem={appItem}
                      currentFolder={currentFolder}
                      folders={this.getTargetFolders()}
                      isAdmin={isAdmin}
                      onMoveAppToFolder={this.onMoveAppToFolder}
                      leaveApp={this.props.leaveApp}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

AppFolderDialog.propTypes = propTypes;
AppFolderDialog.defaultProps = { currentFolder: null };

export default AppFolderDialog;
