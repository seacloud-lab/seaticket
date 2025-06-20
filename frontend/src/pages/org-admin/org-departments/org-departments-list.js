import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import MainPanelTopbar from '../main-panel-topbar';
import ModalPortal from '../../../components/modal-portal';
import DeleteDepartDialog from '../../../components/dialog/org-delete-department-dialog';
import RenameDepartmentDialog from '../../../components/dialog/org-rename-department-dialog';
import AddNewOrgDepartment from './common-operations/add-new-org-department';
import GroupItem from './sub-departments/group-item';
import Loading from '../../../components/loading';
import { enableAddressBookV2, gettext, orgID } from '../../../constants';
import MigrateToNewVersionOperation from './common-operations/migrate-to-new-version-operation';
import { orgAdminServiceApi } from '../../../api/org-admin-service-api';

const propTypes = {
  onCloseSidePanel: PropTypes.func
};

class OrgDepartmentsList extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      groups: [],
      groupID: '',
      groupName: '',
      showDeleteDepartDialog: false,
      isShowAddDepartDialog: false,
      renameDepartmentDialog: false,
      isItemFreezed: false,
    };
  }

  componentDidMount() {
    this.listDepartGroups();
  }

  listDepartGroups = () => {
    orgAdminServiceApi.orgAdminListDepartGroups(orgID).then((res) => {
      this.setState({
        isLoading: false,
        groups: res.data.data,
      });
    });
  };

  showDeleteDepartDialog = (group) => {
    this.setState({
      showDeleteDepartDialog: true,
      groupID: group.id,
      groupName: group.name,
    });
  };

  showRenameDepartmentDialog = (group) => {
    this.setState({
      renameDepartmentDialog: true,
      groupID: group.id,
      groupName: group.name,
    });
  };

  toggleAddDepartDialog = () => {
    this.setState({ isShowAddDepartDialog: !this.state.isShowAddDepartDialog });
  };

  toggleCancel = () => {
    this.setState({
      showDeleteDepartDialog: false,
      renameDepartmentDialog: false,
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
    const {
      groupID,
      groupName,
      renameDepartmentDialog,
      showDeleteDepartDialog,
    } = this.state;

    return (
      <Fragment>
        {renameDepartmentDialog && (
          <ModalPortal>
            <RenameDepartmentDialog
              toggle={this.toggleCancel}
              groupID={groupID.toString()}
              groupName={groupName}
              onDepartChanged={this.onDepartChanged}
            />
          </ModalPortal>
        )}
        {showDeleteDepartDialog && (
          <ModalPortal>
            <DeleteDepartDialog
              toggle={this.toggleCancel}
              groupID={groupID.toString()}
              groupName={groupName}
              onDepartChanged={this.onDepartChanged}
            />
          </ModalPortal>
        )}
      </Fragment>
    );
  };

  onMigrateSuccess = () => {
    this.setState({ groups: [] });
  };

  render() {
    const { onCloseSidePanel } = this.props;
    const { groupID, groups, isLoading, isItemFreezed } = this.state;

    return (
      <Fragment>
        <MainPanelTopbar onCloseSidePanel={onCloseSidePanel}>
          <AddNewOrgDepartment
            groupID={groupID.toString()}
            title={gettext('New department')}
            onDepartChanged={this.onDepartChanged}
          />
          { enableAddressBookV2 && !isLoading && groups.length > 0 &&
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
                      <th width="30%">{gettext('Name')}</th>
                      <th width="45%">{gettext('Created at')}</th>
                      <th width="12%" className="text-center">
                        {gettext('Operations')}
                      </th>
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
                          showDeleteDepartDialog={this.showDeleteDepartDialog}
                          showRenameDepartmentDialog={this.showRenameDepartmentDialog}
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

OrgDepartmentsList.propTypes = propTypes;

export default OrgDepartmentsList;
