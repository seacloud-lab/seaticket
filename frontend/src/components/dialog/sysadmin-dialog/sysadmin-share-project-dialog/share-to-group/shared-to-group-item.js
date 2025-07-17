import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import ProjectSharePermissionEditor from '../../../../select-editor/project-share-permission-editor';
import { gettext } from '../../../../../constants';
import IconButton from '../../../../icon-button';

class SharedToGroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false,
    };
  }

  onMouseEnter = () => {
    this.setState({ isOperationShow: true });
  };

  onMouseLeave = () => {
    this.setState({ isOperationShow: false });
  };

  updateProjectShare = (permission) => {
    if (permission === 'addCustomSharePermission') return;
    if (permission !== this.props.groupShare.permission) {
      this.props.updateProjectShare(this.props.groupShare.group_id, permission);
    }
  };

  deleteProjectShare = () => {
    this.props.deleteProjectShare(this.props.groupShare.group_id);
  };

  render() {
    const { group_name, permission } = this.props.groupShare;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td>{group_name}</td>
        <td>
          <ProjectSharePermissionEditor
            isTextMode={true}
            isEditIconShow={this.state.isOperationShow}
            currentPermission={permission}
            customSharePermissions={this.props.customSharePermissions}
            onPermissionChanged={this.updateProjectShare}
            onAddCustomSharePermission={this.props.onAddCustomSharePermission}
          />
        </td>
        <td>
          <IconButton
            icon="x"
            className={classnames('action-icon ml-8', { 'hide': !this.state.isOperationShow })}
            onClick={this.deleteProjectShare}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

SharedToGroupItem.propTypes = {
  groupShare: PropTypes.object.isRequired,
  updateProjectShare: PropTypes.func.isRequired,
  deleteProjectShare: PropTypes.func.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
};

export default SharedToGroupItem;
