import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import Loading from '../../../../components/loading';
import DeleteDepartDialog from '../../../../components/dialog/org-delete-department-dialog';
import RenameDepartmentDialog from '../../../../components/dialog/org-rename-department-dialog';
import GroupItem from './group-item';
import { gettext } from '../../../../constants';

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
      isShowRenameDialog: false,
      isShowDeleteDialog: false,
      subGroupID: '',
      subGroupName: '',
    };
  }

  onDepartChanged = () => {
    this.props.onDepartChanged();
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  showDeleteDepartDialog = (subGroup) => {
    this.setState({
      isShowDeleteDialog: true,
      subGroupID: subGroup.id,
      subGroupName: subGroup.name
    });
  };

  showRenameDepartmentDialog = (subGroup) => {
    this.setState({
      isShowRenameDialog: true,
      subGroupID: subGroup.id,
      subGroupName: subGroup.name
    });
  };

  toggleCancel = () => {
    this.setState({
      isShowDeleteDialog: false,
      isShowRenameDialog: false,
    });
  };

  toggleItemFreezed = () => {
    this.setState({ isItemFreezed: this.state.isItemFreezed });
  };

  renderOperationDialogs = () => {
    const { isShowRenameDialog, isShowDeleteDialog, subGroupID, subGroupName } = this.state;
    const Dialog = isShowRenameDialog ? RenameDepartmentDialog : DeleteDepartDialog;

    return (
      (isShowRenameDialog || isShowDeleteDialog) && (
        <Dialog
          groupID={subGroupID.toString()}
          groupName={subGroupName}
          onDepartChanged={this.onDepartChanged}
          toggle={this.toggleCancel}
        />
      )
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
                    <th width="20%" className="text-center">{gettext('Operations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    return (
                      <GroupItem
                        key={group.id}
                        group={group}
                        isItemFreezed={isItemFreezed}
                        onFreezedItem={this.onFreezedItem}
                        onUnfreezedItem={this.onUnfreezedItem}
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
