import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { PERMISSION_TYPES } from '../../../constants';

class ViewSharePermission extends Component {

  shouldComponentUpdate(nextProps) {
    return nextProps.viewPermission !== this.props.viewPermission ||
      nextProps.viewPermissionDisabled !== this.props.viewPermissionDisabled;
  }

  updateViewPermissionReadWrite = (evt) => {
    let updatedViewPermission = evt.target.checked ? PERMISSION_TYPES.READ_WRITE : null;
    this.props.updateViewPermission(updatedViewPermission);
  };

  updateViewPermissionReadOnly = (evt) => {
    let updatedViewPermission = evt.target.checked ? PERMISSION_TYPES.READ_ONLY : null;
    this.props.updateViewPermission(updatedViewPermission);
  };

  render() {
    let { viewName, viewPermission, viewPermissionDisabled } = this.props;

    return (
      <div className="view d-flex align-items-center">
        <div className="view-name d-flex align-items-center">
          <span className="name-text text-truncate" title={viewName}>{viewName}</span>
        </div>
        <div className="share-permission-operator read-write">
          <input
            type="checkbox"
            disabled={viewPermissionDisabled}
            checked={viewPermission === PERMISSION_TYPES.READ_WRITE}
            onChange={this.updateViewPermissionReadWrite}
          />
        </div>
        <div className="share-permission-operator read-only">
          <input
            type="checkbox"
            disabled={viewPermissionDisabled}
            checked={viewPermission === PERMISSION_TYPES.READ_ONLY}
            onChange={this.updateViewPermissionReadOnly}
          />
        </div>
      </div>
    );
  }
}

ViewSharePermission.propTypes = {
  viewPermissionDisabled: PropTypes.bool,
  viewName: PropTypes.string,
  viewPermission: PropTypes.string,
  updateViewPermission: PropTypes.func,
};

export default ViewSharePermission;
