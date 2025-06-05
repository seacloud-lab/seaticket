import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { PERMISSION_TYPES } from 'dtable-utils';
import ViewSharePermission from './view-share-permission';

class TableSharePermission extends Component {

  constructor(props) {
    super(props);
    this.state = {
      expanded: true
    };
  }

  onToggleExpandTable = () => {
    this.setState({ expanded: !this.state.expanded });
  };

  updatedTablePermissionReadWrite = (evt) => {
    const { _id } = this.props.table;
    const updatedTablePermission = evt.target.checked ? PERMISSION_TYPES.READ_WRITE : null;
    this.props.updatedTablePermission(_id, updatedTablePermission);
  };

  updatedTablePermissionReadOnly = (evt) => {
    const { _id } = this.props.table;
    const updatedTablePermission = evt.target.checked ? PERMISSION_TYPES.READ_ONLY : null;
    this.props.updatedTablePermission(_id, updatedTablePermission);
  };

  render() {
    const { table } = this.props;
    const { _id: tableId, name: tableName, views, permission: tablePermission } = table;
    let viewPermissionDisabled = false;
    if ([PERMISSION_TYPES.READ_ONLY, PERMISSION_TYPES.READ_WRITE].includes(tablePermission)) {
      viewPermissionDisabled = true;
    }

    return (
      <div className="table-share-permission">
        <div className="table d-flex">
          <div className="table-name d-flex align-items-center">
            <span className="toggle-expand-btn" onClick={this.onToggleExpandTable}>
              <i className={`icon-toggle-expand dtable-font dtable-icon-down3 ${this.state.expanded ? '' : 'rotate-270'}`}></i>
            </span>
            <span className="name-text text-truncate" title={tableName}>{tableName}</span>
          </div>
          <div className="share-permission-operator read-write">
            <input
              type="checkbox"
              checked={tablePermission === PERMISSION_TYPES.READ_WRITE}
              onChange={this.updatedTablePermissionReadWrite}
            />
          </div>
          <div className="share-permission-operator read-only">
            <input
              type="checkbox"
              checked={tablePermission === PERMISSION_TYPES.READ_ONLY}
              onChange={this.updatedTablePermissionReadOnly}
            />
          </div>
        </div>
        {this.state.expanded && views.map((view, index) => {
          let { name, permission } = view;
          if (viewPermissionDisabled) {
            permission = null;
          }
          return (
            <ViewSharePermission
              key={`view-share-permission-${index}`}
              viewPermissionDisabled={viewPermissionDisabled}
              viewName={name}
              viewPermission={permission}
              updateViewPermission={this.props.updateViewPermission.bind(this, tableId, view._id)}
            />
          );
        })}
      </div>
    );
  }
}

TableSharePermission.propTypes = {
  table: PropTypes.object,
  updatedTablePermission: PropTypes.func,
  updateViewPermission: PropTypes.func,
};

export default TableSharePermission;
