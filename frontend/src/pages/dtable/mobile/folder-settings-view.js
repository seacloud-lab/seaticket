import React from 'react';
import PropTypes from 'prop-types';
import { Input } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import MobileCommonHeader from './mobile-common-header';
import { gettext } from '../../../constants/config';
import { validateName } from '../../../utils/utils';

import '../../../css/mobile/add-blank-table.css';

const propTypes = {
  onFolderSettingsToggle: PropTypes.func.isRequired,
  onNameChange: PropTypes.func.isRequired,
  folderName: PropTypes.string.isRequired,
};

class AddBlankFolder extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      folderName: props.folderName,
    };
  }

  saveFolderSettings = () => {
    let response = validateName(this.state.folderName);
    if (!response.isValid) {
      toaster.danger(response.message);
      return;
    }
    const folderName = response.message;
    if (this.props.folderName !== folderName) {
      this.props.onNameChange(folderName);
    }
    this.props.onFolderSettingsToggle();
  };

  onNameChange = (e) => {
    this.setState({ folderName: e.target.value });
  };

  render() {
    let { folderName } = this.state;
    return (
      <div className="add-blank-table">
        <MobileCommonHeader
          title={gettext('Rename')}
          leftName={gettext('Cancel')}
          rightName={gettext('Done')}
          onLeftClick={this.props.onFolderSettingsToggle}
          onRightClick={this.saveFolderSettings}
        />
        <Input
          className="create-table-input"
          placeholder={gettext('Enter name')}
          value={folderName}
          onChange={this.onNameChange}
        />
      </div>
    );
  }
}

AddBlankFolder.propTypes = propTypes;

export default AddBlankFolder;
