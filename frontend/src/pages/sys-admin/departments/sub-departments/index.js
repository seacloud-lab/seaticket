import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../../utils/constants';
import Loading from '../../../../components/loading';
import DeleteDepartDialog from '../../../../components/dialog/sysadmin-dialog/sysadmin-delete-department-dialog';
import RenameDepartmentDialog from '../../../../components/dialog/sysadmin-dialog/sysadmin-rename-departmet-dialog';
import GroupItem from './group-item';

const propTypes = {
  groupID: PropTypes.string,
  onDepartChanged: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  groups: PropTypes.array,
};

class SubDepartments extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isItemFreezed: false,
      subGroupID: '',
      subGroupName: '',
    };
  }

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: this.state.isItemFreezed });
  };

  showRenameDepartmentDialog = (subGroup) => {
    this.setState({
      isShowRenameDialog: true,
      subGroupID: subGroup.id,
      subGroupName: subGroup.name
    });
  };

  showDeleteDepartDialog = (subGroup) => {
    this.setState({
      isShowDeleteDialog: true,
      subGroupID: subGroup.id,
      subGroupName: subGroup.name
    });
  };

  onDepartChanged = () => {
    this.props.onDepartChanged();
  };

  toggleCancel = () => {
    this.setState({
      isShowDeleteDialog: false,
      isShowRenameDialog: false,
    });
  };

  renderOperationDialogs = () => {
    const { isShowRenameDialog, isShowDeleteDialog, subGroupID, subGroupName } = this.state;

    return (
      <Fragment>
        {isShowRenameDialog && (
          <RenameDepartmentDialog
            groupID={subGroupID.toString()}
            groupName={subGroupName}
            onDepartChanged={this.onDepartChanged}
            toggle={this.toggleCancel}
          />
        )}
        {isShowDeleteDialog && (
          <DeleteDepartDialog
            groupID={subGroupID}
            groupName={subGroupName}
            onDepartChanged={this.onDepartChanged}
            toggle={this.toggleCancel}
          />
        )}
      </Fragment>
    );
  };

  render() {
    const { isLoading, groups } = this.props;
    const { isItemFreezed } = this.state;
    return (
      <Fragment>
        <div className="cur-view-subcontainer org-groups">
          <div className="cur-view-content">
            {isLoading && <Loading />}
            {!isLoading && groups.length === 0 && (
              <p className="no-group">{gettext('No sub-departments')}</p>
            )}
            {!isLoading && groups.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th width="50%">{gettext('Name')}</th>
                    <th width="30%">{gettext('Created at')}</th>
                    <th width="20%"></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    return (
                      <GroupItem
                        key={group.id}
                        group={group}
                        isItemFreezed={isItemFreezed}
                        onFreezedItem={this.toggleItemFreezed}
                        onUnfreezedItem={this.toggleItemFreezed}
                        showRenameDepartmentDialog={this.showRenameDepartmentDialog}
                        showDeleteDepartDialog={this.showDeleteDepartDialog}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {this.renderOperationDialogs()}
      </Fragment>
    );
  }
}

SubDepartments.propTypes = propTypes;

export default SubDepartments;
