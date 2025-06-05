import React, { Component } from 'react';
import PropTypes from 'prop-types';
import SharePermissionsManage from './share-permissions-widgets/share-permissions-manage';
import AddSharePermission from './share-permissions-widgets/add-share-permission';
import EditSharePermission from './share-permissions-widgets/edit-share-permission';

import '../../../css/share-permissions.css';

const STATUS = {
  PERMISSION_MANAGE: 'permission_manage',
  ADD_PERMISSION: 'add_permission',
  UPDATE_PERMISSION: 'update_permission'
};

class SharePermissions extends Component {

  constructor(props) {
    super(props);
    this.state = {
      status: STATUS.PERMISSION_MANAGE,
      editingPermissionIndex: -1,
    };
  }

  onChangeStatus = (status) => {
    this.setState({ status });
  };

  onEditSharePermission = (index) => {
    this.setState({
      status: STATUS.UPDATE_PERMISSION,
      editingPermissionIndex: index,
    });
  };

  onAddSharePermission = (permission) => {
    this.setState({ status: STATUS.PERMISSION_MANAGE }, () => {
      this.props.onAddSharePermission(permission);
    });
  };

  onUpdateSharePermission = (permissionId, permission) => {
    this.setState({ status: STATUS.PERMISSION_MANAGE }, () => {
      this.props.onUpdateSharePermission(permissionId, permission);
    });
  };

  onDeleteSharePermission = (index) => {
    this.props.onDeleteSharePermission(index);
  };

  render() {
    const { customSharePermissions, workspaceID, name } = this.props;
    const { status, editingPermissionIndex } = this.state;
    return (
      <div>
        {status === STATUS.PERMISSION_MANAGE &&
          <SharePermissionsManage
            permissions={customSharePermissions}
            onChangeStatus={() => this.onChangeStatus(STATUS.ADD_PERMISSION)}
            onEditSharePermission={this.onEditSharePermission}
            onDeleteSharePermission={this.onDeleteSharePermission}
          />
        }
        {status === STATUS.ADD_PERMISSION &&
          <AddSharePermission
            workspaceID={workspaceID}
            name={name}
            onChangeStatus={() => this.onChangeStatus(STATUS.PERMISSION_MANAGE)}
            onAddSharePermission={this.onAddSharePermission}
          />
        }
        {status === STATUS.UPDATE_PERMISSION &&
          <EditSharePermission
            permissionId={customSharePermissions[editingPermissionIndex].id}
            workspaceID={workspaceID}
            name={name}
            onChangeStatus={() => this.onChangeStatus(STATUS.PERMISSION_MANAGE)}
            onUpdateSharePermission={this.onUpdateSharePermission}
          />
        }
      </div>
    );
  }
}

SharePermissions.propTypes = {
  customPermissionStatus: PropTypes.string,
  customSharePermissions: PropTypes.array,
  workspaceID: PropTypes.number,
  name: PropTypes.string,
  onAddSharePermission: PropTypes.func,
  onUpdateSharePermission: PropTypes.func,
  onDeleteSharePermission: PropTypes.func,
};

export default SharePermissions;
