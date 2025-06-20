import React from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import Folder from '../model/folder';
import MobileCommonHeader from './mobile-common-header';
import { gettext } from '../../../utils/constants';
import { seaQAAPI } from '../../../api/web-api';
import { Utils, validateName } from '../../../utils/utils';

import '../../../css/mobile/add-blank-table.css';

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onCreateFolderToggle: PropTypes.func.isRequired,
  createBlankFolder: PropTypes.func.isRequired,
};

class AddBlankFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      folderName: '',
    };
  }

  onCreateFolderToggle = () => {
    this.props.onCreateFolderToggle();
  };

  handleError = (err) => {
    let errMsg = Utils.getErrorMsg(err, true);
    if (!err.response || err.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onCreateFolder = () => {
    const { currentWorkspace } = this.props;
    let response = validateName(this.state.folderName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    seaQAAPI.createFolder(currentWorkspace.id, response.message).then((res) => {
      let newFolder = new Folder(res.data.folder);
      this.props.createBlankFolder(newFolder);
      this.props.onCreateFolderToggle();
    }).catch((error) => {
      this.handleError(error);
      this.props.onCreateFolderToggle();
    });
  };

  handleChange = (e) => {
    this.setState({ folderName: e.target.value });
  };

  render() {
    return (
      <div className="add-blank-table">
        <MobileCommonHeader
          title={gettext('Create a folder')}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onLeftClick={this.onCreateFolderToggle}
          onRightClick={this.onCreateFolder}
        />
        <Input
          className="create-table-input"
          placeholder={gettext('Enter name')}
          value={this.state.folderName}
          onChange={this.handleChange}
        />
      </div>
    );
  }
}

AddBlankFolder.propTypes = propTypes;

export default AddBlankFolder;
