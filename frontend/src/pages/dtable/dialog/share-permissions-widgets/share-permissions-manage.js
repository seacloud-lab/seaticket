import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import CommonOperationConfirmationDialog from '../../../../components/dialog/common-operation-confirmation-dialog';
import { gettext, siteRoot } from '../../../../constants';

class SharePermissionsManage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isConfirmDeleteOpen: false,
      deletePermissionName: '',
      deletePermissionId: '',
    };
  }

  toggleConfirmDeleteDialog = (name, id) => {
    this.setState({
      deletePermissionName: name,
      isConfirmDeleteOpen: !this.state.isConfirmDeleteOpen,
      deletePermissionId: id,
    });
  };

  deletePermission = (index) => {
    this.props.onDeleteSharePermission(index);
    this.setState({
      isConfirmDeleteOpen: false,
      deletePermissionName: '',
      deletePermissionId: '',
    });
  };

  renderPermissionsContent = () => {
    const { permissions } = this.props;
    const { isConfirmDeleteOpen, deletePermissionName } = this.state;
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return (
        <div className="no-share-permissions d-flex flex-column align-items-center justify-content-center">
          <img src={`${siteRoot}media/img/no-share-permissions.png`} alt=""/>
          <p>{gettext('No sharing permissions')}</p>
        </div>
      );
    }
    return (
      <Fragment>
        <table className="permissions-list-header">
          <thead>
            <tr>
              <th width='26%'>{gettext('Permission name')}</th>
              <th width='52%'>{gettext('Permission description')}</th>
              <th width='22%'></th>
            </tr>
          </thead>
        </table>
        <div className="permissions-list-body">
          <table>
            <tbody>
              {permissions.map((permission, index) => {
                const { id, name, description } = permission;
                return (
                  <tr key={`share-permission-${id}`}>
                    <td width='27%' className="text-truncate" title={name}>{name}</td>
                    <td width='52%' className="text-truncate" title={description}>{description}</td>
                    <td width='21%'>
                      <span
                        className="permission-operation-btn edit"
                        onClick={() => this.props.onEditSharePermission(index)}
                        title={gettext('Edit')}
                        aria-label={gettext('Edit')}
                      >
                        <i className="dtable-font dtable-icon-rename" aria-hidden="true"></i>
                      </span>
                      <span
                        className="permission-operation-btn delete"
                        onClick={() => this.toggleConfirmDeleteDialog(name, id)}
                        title={gettext('Delete')}
                        aria-label={gettext('Delete')}
                      >
                        <i className="dtable-font dtable-icon-delete" aria-hidden="true"></i>
                      </span>
                      {isConfirmDeleteOpen && (
                        <CommonOperationConfirmationDialog
                          title={gettext('Delete custom sharing permission')}
                          message={gettext('Are you sure you want to delete custom sharing permission {placeholder} ?').replace('{placeholder}', `<b>${deletePermissionName}</b>`)}
                          executeOperation={() => this.deletePermission(index)}
                          confirmBtnText={gettext('Delete')}
                          toggleDialog={() => this.toggleConfirmDeleteDialog('', '')}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Fragment>
    );
  };

  render() {
    return (
      <div className="share-permissions-manage">
        <div className="share-permissions-manage-header d-flex align-items-center justify-content-between">
          <span>{gettext('Permission')}</span>
          <Button onClick={this.props.onChangeStatus} color="outline-primary" size="sm">{gettext('Add permission')}</Button>
        </div>
        <div className="permissions-list">
          {this.renderPermissionsContent()}
        </div>
      </div>
    );
  }
}

SharePermissionsManage.propTypes = {
  permissions: PropTypes.array,
  onChangeStatus: PropTypes.func,
  onEditSharePermission: PropTypes.func,
  onDeleteSharePermission: PropTypes.func,
};

export default SharePermissionsManage;
