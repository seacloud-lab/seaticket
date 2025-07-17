import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { gettext } from '../../../../constants/config';
import { seaQAAPI } from '../../../../api/web-api';
import { PERMISSION_TYPES } from '../../../../constants';
import BaseSharePermission from './base-share-permission';
import Loading from '../../../../components/loading';
import { IconButton } from '../../../components';

class EditSharePermission extends Component {

  constructor(props) {
    super(props);
    this.state = {
      basePermission: null,
      errMessage: '',
      isLoading: true,
    };
  }

  componentDidMount() {
    const { workspaceID, name, permissionId } = this.props;
    seaQAAPI.getSharePermission(workspaceID, name, permissionId).then((res) => {
      const basePermission = this.getFormattedBasePermission(res.data.permission);
      this.setState({ basePermission, isLoading: false });
    });
  }

  getFormattedBasePermission = (basePermission) => {
    if (!basePermission) return null;
    let updatedBasePermission = { ...basePermission };
    let updatedPermission = updatedBasePermission.permission.map((table) => {
      let updatedTable = { ...table };
      let { permission: tablePermission, views } = updatedTable;
      if ([PERMISSION_TYPES.READ_WRITE, PERMISSION_TYPES.READ_ONLY].includes(tablePermission)) {
        let updatedViews = views.map((view) => {
          return { ...view, permission: null };
        });
        updatedTable.views = updatedViews;
      }
      return updatedTable;
    });
    updatedBasePermission.permission = updatedPermission;
    return updatedBasePermission;
  };

  updateBasePermission = (basePermission) => {
    this.setState({ basePermission });
  };

  onUpdateSharePermission = () => {
    const { basePermission } = this.state;
    if (!basePermission) return;
    const { name, description } = basePermission;
    let errMessage = '';
    if (!name || !name.trim()) {
      errMessage = 'Name is required';
    }
    if (!errMessage && (!description || !description.trim())) {
      errMessage = 'Description is required';
    }
    this.setState({ errMessage });
    if (errMessage) return;
    this.props.onUpdateSharePermission(basePermission);
  };

  render() {
    const { isLoading, basePermission, errMessage } = this.state;
    return (
      <div className="edit-share-permission">
        <div className="edit-share-permission-header d-flex align-items-center justify-content-between">
          <span>
            <IconButton icon="return" className="back-btn d-inline-flex" onClick={this.props.onChangeStatus} />
            <span className="edit-share-permission-header-text">{gettext('Edit permission')}</span>
          </span>
          <Button onClick={this.onUpdateSharePermission} color="outline-primary" size="sm" className="edit-share-permission-btn">{gettext('Submit')}</Button>
        </div>
        {isLoading && <div className="share-permission-loading-tips"><Loading /></div>}
        {(!isLoading && basePermission) &&
          <BaseSharePermission
            basePermission={basePermission}
            errMessage={errMessage}
            updateBasePermission={this.updateBasePermission}
          />
        }
      </div>
    );
  }
}

EditSharePermission.propTypes = {
  permissionId: PropTypes.number,
  workspaceID: PropTypes.number,
  name: PropTypes.string,
  onChangeStatus: PropTypes.func,
  onUpdateSharePermission: PropTypes.func,
};

export default EditSharePermission;
