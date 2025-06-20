import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import DtableSharePermissionEditor from '../../../select-editor/dtable-share-permission-editor';
import GroupSelect from '../../../group-select';
import SharedToGroupItem from './shared-to-group-item';
import { orgAdminServiceApi } from '../../../../api/org-admin-service-api';
import { orgID, gettext } from '../../../../constants';
import { Utils } from '../../../../utils/utils';

import '../../../../css/invitations.css';

const OrgAdminShareTableToGroupPropTypes = {
  currentTable: PropTypes.object.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func
};

class OrgAdminShareTableToGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      permission: 'rw',
      groupIDs: [],
      groupShares: [],
    };
    this.dtableUuid = this.props.currentTable.uuid;
  }

  componentDidMount() {
    orgAdminServiceApi.orgAdminListTableShares(orgID, this.dtableUuid).then((res) => {
      const { group_shares: groupShares } = res.data || {};
      this.setState({ groupShares });
    }).catch(error => {
      this.handleError(error);
    });
  }

  setPermission = (permission) => {
    this.setState({ permission });
  };

  addTableShare = () => {
    const { groupIDs, permission } = this.state;
    groupIDs.forEach((groupID) => {
      orgAdminServiceApi.orgAdminAddTableGroupShare(orgID, this.dtableUuid, groupID, permission).then((res) => {
        let groupShares = this.state.groupShares.slice();
        groupShares.push(res.data.dtable_group_share);
        this.setState({ groupShares: groupShares });
      }).catch((error) => {
        this.handleError(error);
      });
    });
    this.groupSelect.clearSelect();
  };

  updateTableShare = (groupID, permission) => {
    orgAdminServiceApi.orgAdminUpdateTableGroupShare(orgID, this.dtableUuid, groupID, permission).then(() => {
      const groupShares = this.state.groupShares.map((item) => {
        if (item.group_id === groupID) {
          item.permission = permission;
        }
        return item;
      });
      this.setState({ groupShares });
    }).catch((error) => {
      this.handleError(error);
    });
  };

  deleteTableShare = (groupID) => {
    orgAdminServiceApi.orgAdminDeleteTableGroupShare(orgID, this.dtableUuid, groupID).then(() => {
      const groupShares = this.state.groupShares.filter((item) => item.group_id !== groupID);
      this.setState({ groupShares });
    }).catch((error) => {
      this.handleError(error);
    });
  };

  handleError = (error) => {
    if (!error.response || error.response.status !== 403) {
      const errMsg = Utils.getErrorMsg(error, true);
      toaster.danger(errMsg);
    }
  };

  loadOptions = (input, callback) => {
    const value = input.trim();
    if (value.length === 0) {
      return;
    }
    orgAdminServiceApi.orgAdminSearchGroups(orgID, value).then((res) => {
      const { group_list } = res.data;
      this.options = group_list.map((item) => {
        return {
          value: item.name,
          group_id: item.id,
          label: <span className='select-module select-module-name'>{item.name}</span>,
        };
      });
      callback(this.options);
    }).catch(error => {
      const errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onSelectChange = (options) => {
    this.setState({
      groupIDs: options ? options.map(item => item.group_id) : [],
      errMessage: [],
    });
  };

  renderSharedGroups = () => {
    const { groupShares } = this.state;
    return groupShares.map((item, index) => {
      return (
        <SharedToGroupItem
          groupShare={item}
          key={index}
          updateTableShare={this.updateTableShare}
          deleteTableShare={this.deleteTableShare}
          customSharePermissions={this.props.customSharePermissions}
          onAddCustomSharePermission={this.props.onAddCustomSharePermission}
        />
      );
    });
  };

  render() {
    return (
      <div className="share-link-container sysadmin-share-to-group">
        <table>
          <thead>
            <tr>
              <th width='45%'>{gettext('Group')}</th>
              <th width='35%'>{gettext('Permission')}</th>
              <th width='20%'></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <GroupSelect
                  placeholder={gettext('Search groups')}
                  onSelectChange={this.onSelectChange}
                  ref={ref => this.groupSelect = ref}
                  isMulti={true}
                  loadOptions={this.loadOptions}
                />
              </td>
              <td>
                <DtableSharePermissionEditor
                  isTextMode={false}
                  isEditIconShow={false}
                  currentPermission={this.state.permission}
                  customSharePermissions={this.props.customSharePermissions}
                  onPermissionChanged={this.setPermission}
                  onAddCustomSharePermission={this.props.onAddCustomSharePermission}
                />
              </td>
              <td>
                <Button className="w-100" onClick={this.addTableShare}>{gettext('Submit')}</Button>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="h-100">
          <table className="table-thead-hidden">
            <thead>
              <tr>
                <th width="46%">{gettext('Group')}</th>
                <th width="34%">{gettext('Permission')}</th>
                <th width="20%"></th>
              </tr>
            </thead>
            <tbody>
              {this.renderSharedGroups()}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

OrgAdminShareTableToGroup.propTypes = OrgAdminShareTableToGroupPropTypes;

export default OrgAdminShareTableToGroup;
