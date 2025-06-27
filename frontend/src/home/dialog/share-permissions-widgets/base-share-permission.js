import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { FormGroup, Label, Input, Alert } from 'reactstrap';
import { gettext } from '../../../../constants/config';
import { PERMISSION_TYPES } from '../../../../constants';
import TableSharePermission from './table-share-permission';

class BaseSharePermission extends PureComponent {

  onChangePermissionName = (evt) => {
    const { basePermission } = this.props;
    const { name } = basePermission;
    const newName = evt.target.value;
    if (newName === name) return;
    this.props.updateBasePermission(Object.assign({}, basePermission, { name: newName }));
  };

  onChangePermissionDescription = (evt) => {
    const { basePermission } = this.props;
    const { description } = basePermission;
    const newDescription = evt.target.value;
    if (newDescription === description) return;
    this.props.updateBasePermission(Object.assign({}, basePermission, { description: newDescription }));
  };

  updatedTablePermission = (tableId, updatedTablePermission) => {
    const { basePermission } = this.props;
    const { permission } = basePermission;
    let updatedBasePermission = { ...basePermission };
    let updatedPermission = [...permission];
    const tableIndex = updatedPermission.findIndex((table) => table._id === tableId);
    if (tableIndex < 0) return;
    let updatedTable = updatedPermission[tableIndex];
    updatedTable.permission = updatedTablePermission;

    // set view's permission to null, if table's permission is read-only or read-write.
    const { views } = updatedTable;
    if (updatedTablePermission && Array.isArray(views)) {
      let updatedViews = [...views];
      updatedViews.forEach((view) => {
        view.permission = null;
      });
      updatedTable.views = updatedViews;
    }

    updatedPermission[tableIndex] = updatedTable;
    updatedBasePermission.permission = updatedPermission;
    this.props.updateBasePermission(updatedBasePermission);
  };

  updateViewPermission = (tableId, viewId, updatedViewPermission) => {
    const { basePermission } = this.props;
    const { permission } = basePermission;
    let updatedBasePermission = { ...basePermission };
    let updatedPermission = [...permission];
    const tableIndex = updatedPermission.findIndex((table) => table._id === tableId);
    if (tableIndex < 0) return;
    let updatedTable = updatedPermission[tableIndex];
    const { views, permission: tablePermission } = updatedTable;
    const viewIndex = views.findIndex((view) => view._id === viewId);
    if (viewIndex < 0) return;
    updatedTable.views[viewIndex].permission = updatedViewPermission;

    // set table's permission to detail, if view's permission is not null.
    if (tablePermission === null) {
      updatedTable.permission = PERMISSION_TYPES.DETAIL;
    }

    updatedPermission[tableIndex] = updatedTable;
    updatedBasePermission.permission = updatedPermission;
    this.props.updateBasePermission(updatedBasePermission);
  };

  render() {
    const { errMessage, basePermission } = this.props;
    const { name, description, permission } = basePermission;

    return (
      <div className="base-share-permission">
        <div className="permission-name-desc d-flex">
          <FormGroup className="permission-name">
            <Label>{gettext('Permission name')}</Label>
            <Input value={name || ''} onChange={this.onChangePermissionName} />
          </FormGroup>
          <FormGroup className="permission-desc">
            <Label>{gettext('Permission description')}</Label>
            <Input value={description || ''} onChange={this.onChangePermissionDescription} />
          </FormGroup>
        </div>
        {errMessage && <Alert color="danger">{gettext(`${errMessage}`)}</Alert>}
        <div className="base-share-permission-header d-flex">
          <div className="table-title">{gettext('Tables')}</div>
          <div className="view-title">{gettext('Views')}</div>
          <div className="share-permission-operator-title">{gettext('Read Write')}</div>
          <div className="share-permission-operator-title">{gettext('Read Only')}</div>
        </div>
        <div className="base-share-permission-body">
          {Array.isArray(permission) && permission.map((table, index) => {
            return <TableSharePermission
              key={`table-share-permission-${index}`}
              table={table}
              updatedTablePermission={this.updatedTablePermission}
              updateViewPermission={this.updateViewPermission}
            />;
          })}
        </div>
      </div>
    );
  }
}

BaseSharePermission.propTypes = {
  basePermission: PropTypes.object,
  errMessage: PropTypes.string,
  updatedTablePermission: PropTypes.func,
  updateBasePermission: PropTypes.func,
};

export default BaseSharePermission;
