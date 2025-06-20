import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { enableAddressBookV2, gettext } from '../../../constants';
import Loading from '../../../components/loading';
import RenameDepartmentDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-rename-departmet-dialog.js';
import DeleteDepartDialog from '../../../components/dialog/sysadmin-dialog/sysadmin-delete-department-dialog';
import MainPanelTopbar from '../../../pages/sys-admin/main-panel-topbar';
import GroupItem from './sub-departments/group-item';
import { AddDepartmentOperation, MigrateToNewVersionOperation } from './common-operations';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api.js';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class DepartmentsList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      groups: [],
      groupID: '',
      groupName: '',
      isItemFreezed: false,
      isShowRenameDepartmentDialog: false,
      isShowDeleteDepartDialog: false,
    };
  }

  componentDidMount() {
    this.listDepartGroups();
  }

  listDepartGroups = () => {
    sysAdminServiceApi.sysAdminListDepartGroups().then(res => {
      this.setState({
        isLoading: false,
        groups: res.data.data
      });
    });
  };

  showRenameDepartDialog = (group) => {
    this.setState({
      isShowRenameDepartmentDialog: true,
      groupID: group.id,
      groupName: group.name
    });
  };

  showDeleteDepartDialog = (group) => {
    this.setState({
      isShowDeleteDepartDialog: true,
      groupID: group.id,
      groupName: group.name
    });
  };

  toggleCancel = () => {
    this.setState({
      isShowRenameDepartmentDialog: false,
      isShowDeleteDepartDialog: false,
    });
  };

  onDepartChanged = () => {
    this.listDepartGroups();
  };

  onFreezedItem = () => {
    this.setState({ isItemFreezed: true });
  };

  onUnfreezedItem = () => {
    this.setState({ isItemFreezed: false });
  };

  renderDialogOperations = () => {
    const { isShowRenameDepartmentDialog, isShowDeleteDepartDialog, groupID, groupName } = this.state;
    return (
      <React.Fragment>
        {isShowRenameDepartmentDialog && (
          <RenameDepartmentDialog
            groupID={groupID.toString()}
            groupName={groupName}
            onDepartChanged={this.onDepartChanged}
            toggle={this.toggleCancel}
          />
        )}
        {isShowDeleteDepartDialog && (
          <DeleteDepartDialog
            groupID={groupID}
            groupName={groupName}
            onDepartChanged={this.onDepartChanged}
            toggle={this.toggleCancel}
          />
        )}
      </React.Fragment>
    );
  };

  onMigrateSuccess = () => {
    this.setState({ groups: [] });
  };

  render() {
    const { isLoading, groups } = this.state;
    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={this.props.onCloseSidePanel}>
          <AddDepartmentOperation title={gettext('New department')} onDepartChanged={this.onDepartChanged} />
          {enableAddressBookV2 && !isLoading && groups.length > 0 &&
            <MigrateToNewVersionOperation
              title={gettext('Migrate to new version')}
              onMigrateSuccess={this.onMigrateSuccess}
            />
          }
        </MainPanelTopbar>
        <div className="main-panel-center flex-row h-100">
          <div className="cur-view-container o-auto">
            <h2 className="heading">{gettext('Departments')}</h2>
            <div className="cur-view-content">
              {isLoading && <Loading />}
              {!isLoading && groups.length === 0 && (
                <p className="no-group">{gettext('No departments')}</p>
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
                    {groups.map(group => {
                      return (
                        <GroupItem
                          key={group.id}
                          group={group}
                          isItemFreezed={this.state.isItemFreezed}
                          onFreezedItem={this.onFreezedItem}
                          onUnfreezedItem={this.onUnfreezedItem}
                          showRenameDepartmentDialog={this.showRenameDepartDialog}
                          showDeleteDepartDialog={this.showDeleteDepartDialog}
                        />
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        {this.renderDialogOperations()}
      </Fragment>
    );
  }
}

DepartmentsList.propTypes = propTypes;

export default DepartmentsList;
