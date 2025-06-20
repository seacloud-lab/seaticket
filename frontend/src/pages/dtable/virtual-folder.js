import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';
import { folderImageSrc } from '../../constants/image-source-constants';
import Rename from '../../components/rename';
import Folder from './model/folder';
import ShareFolder from './model/share-folder';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object,
  createBlankFolder: PropTypes.func,
  hideVirtualFolder: PropTypes.func,
};

class VirtualFolder extends React.Component {

  onCreateFolder = (folderName) => {
    if (!folderName.trim()) {
      return;
    }
    const { currentWorkspace } = this.props;
    if (currentWorkspace) {
      // default folder
      seaQAAPI.createFolder(currentWorkspace.id, folderName).then((res) => {
        let newFolder = new Folder(res.data.folder);
        this.props.createBlankFolder(newFolder);
      }).catch((error) => {
        this.handleError(error);
        this.props.hideVirtualFolder();
      });
    }
    // folder in share with me, no currentWorkspace
    else {
      seaQAAPI.createShareFolder(folderName).then((res) => {
        let newFolder = new ShareFolder(res.data.folder);
        this.props.createBlankFolder(newFolder);
      }).catch((error) => {
        this.handleError(error);
        this.props.hideVirtualFolder();
      });
    }
  };

  handleError = (err) => {
    let errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onRenameCancel = () => {
    const folderName = gettext('Untitled folder');
    this.onCreateFolder(folderName);
    this.props.hideVirtualFolder();
  };

  render() {
    const folderName = gettext('Untitled folder');
    return (
      <div className="virtual-table table-item tr-highlight" id="create-folder">
        <div>
          <img src={folderImageSrc} width="36px" alt="" />
        </div>
        <div className="table-name">
          <Rename
            name={folderName}
            onRenameConfirm={this.onCreateFolder}
            onRenameCancel={this.onRenameCancel}
          />
        </div>
      </div>
    );
  }
}

VirtualFolder.propTypes = propTypes;

export default VirtualFolder;
