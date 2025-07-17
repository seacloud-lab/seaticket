import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import classnames from 'classnames';
import { toaster, CustomizeGroupSelect, IconButton } from '../../components';
import ProjectSharePermissionEditor from '../../components/select-editor/project-share-permission-editor';
import { gettext } from '../../constants';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';

import '../../../css/invitations.css';

const groupItemPropTypes = {
  groupShare: PropTypes.object.isRequired,
  updateProjectShare: PropTypes.func.isRequired,
  deleteProjectShare: PropTypes.func.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
};

const { mediaUrl } = window.app.config;
const { name, username, avatarURL } = window.app.pageOptions;


class GroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isOperationShow: false
    };
  }

  onMouseEnter = () => {
    this.setState({ isOperationShow: true });
  };

  onMouseLeave = () => {
    this.setState({ isOperationShow: false });
  };

  updateProjectShare = (permission) => {
    if (permission === 'addCustomSharePermission') return;
    if (permission !== this.props.groupShare.permission) {
      this.props.updateProjectShare(this.props.groupShare.group_id, permission);
    }
  };

  deleteProjectShare = () => {
    this.props.deleteProjectShare(this.props.groupShare.group_id);
  };

  render() {
    let { group_name, permission } = this.props.groupShare;
    return (
      <tr onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
        <td>{group_name}</td>
        <td>
          <ProjectSharePermissionEditor
            isTextMode={true}
            isEditIconShow={this.state.isOperationShow}
            currentPermission={permission}
            customSharePermissions={this.props.customSharePermissions}
            onPermissionChanged={this.updateProjectShare}
            onAddCustomSharePermission={this.props.onAddCustomSharePermission}
          />
        </td>
        <td>
          <IconButton
            icon="x"
            className={classnames('action-icon', { 'hide': !this.state.isOperationShow })}
            onClick={this.deleteProjectShare}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

GroupItem.propTypes = groupItemPropTypes;

class ShareProjectToGroup extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      permission: 'rw',
      groups: [],
      groupShares: [],
      selectedOptions: [],
    };
  }

  componentDidMount() {
    let { srcGroupID } = this.props;
    let { workspace_id, name } = this.props.currentProject;
    seaQAAPI.listGroups(true).then((res) => {
      let groups = res.data.filter(item => {
        return item.id !== srcGroupID;
      }).map(item => {
        return {
          id: item.id,
          label: item.name,
          name: item.name,
        };
      });
      this.setState({ groups: groups });
      return seaQAAPI.listProjectGroupShares(workspace_id, name);
    }).then((res) => {
      this.setState({ groupShares: res.data.dtable_group_share_list });
    }).catch(error => {
      this.handleError(error);
    });
  }

  setPermission = (permission) => {
    this.setState({ permission: permission });
  };

  addProjectShare = () => {
    let { permission, selectedOptions } = this.state;
    if (!selectedOptions || selectedOptions.length === 0) return;
    const { currentProject, srcGroupID, groupName } = this.props;
    let { workspace_id, name: tableName } = currentProject;
    const groupIDs = selectedOptions.map(item => item.id);
    seaQAAPI.addProjectGroupShare(workspace_id, tableName, groupIDs, permission).then((res) => {
      let groupShares = this.state.groupShares.slice();
      const { success: successGroupShares, failed: failedGroupShares } = res.data;
      if (failedGroupShares.length > 0) {
        failedGroupShares.forEach((share) => {
          toaster.danger(share.error_msg);
        });
      }
      if (successGroupShares.length > 0) {
        groupShares.push(...successGroupShares);
        this.setState({
          groupShares,
          selectedOptions: [],
        });
        groupIDs.forEach((groupID) => {
          let newTable;
          let dtable_share_id = successGroupShares.find(share => share.group_id === groupID).dtable_share_id;
          if (srcGroupID) {
            newTable = Object.assign({
              dtable_share_id,
              from_group_avatar: `${mediaUrl}/avatars/default.png`,
              from_group_name: groupName,
            }, currentProject);
          } else {
            newTable = Object.assign({
              dtable_share_id,
              from_user: username,
              from_user_name: name,
              from_user_avatar: avatarURL,
            }, currentProject);
          }
          this.props.onAddGroupSharedProject(groupID, newTable);
        });
      }
    }).catch((error) => {
      this.handleError(error);
    });
  };

  updateProjectShare = (groupID, permission) => {
    let { workspace_id, name } = this.props.currentProject;
    seaQAAPI.updateProjectGroupShare(workspace_id, name, groupID, permission).then(() => {
      let groupShares = this.state.groupShares.slice();
      groupShares = groupShares.map((item) => {
        if (item.group_id === groupID) {
          item.permission = permission;
        }
        return item;
      });
      this.setState({ groupShares: groupShares });
    }).catch((error) => {
      this.handleError(error);
    });
  };

  deleteProjectShare = (groupID) => {
    let { workspace_id, name } = this.props.currentProject;
    seaQAAPI.deleteProjectGroupShare(workspace_id, name, groupID).then(() => {
      let groupShares = this.state.groupShares.slice();
      groupShares = groupShares.filter((item) => {return item.group_id !== groupID;});
      this.setState({ groupShares: groupShares });
      this.props.onLeaveGroupSharedProject(groupID, this.props.currentProject);
    }).catch((error) => {
      this.handleError(error);
    });
  };

  handleError = (error) => {
    let errMsg = Utils.getErrorMsg(error, true);
    if (!error.response || error.response.status !== 403) {
      toaster.danger(errMsg);
    }
  };

  onChange = (option) => {
    const selectedOptions = this.state.selectedOptions.slice(0);
    const index = selectedOptions.findIndex(item => item.id === option.id);
    if (index > -1) {
      selectedOptions.splice(index, 1);
    } else {
      selectedOptions.push(option);
    }
    this.setState({ selectedOptions: selectedOptions });
  };

  onDeleteOption = (option) => {
    const selectedOptions = this.state.selectedOptions.slice(0);
    const index = selectedOptions.findIndex(item => item.id === option.id);
    if (index > -1) {
      selectedOptions.splice(index, 1);
    }
    this.setState({ selectedOptions: selectedOptions });
  };

  render() {
    let { groupShares } = this.state;
    let renderList = groupShares.map((item, index) => {
      return (
        <GroupItem
          groupShare={item}
          key={index}
          updateProjectShare={this.updateProjectShare}
          deleteProjectShare={this.deleteProjectShare}
          customSharePermissions={this.props.customSharePermissions}
          onAddCustomSharePermission={this.props.onAddCustomSharePermission}
        />
      );
    });
    return (
      <div className="share-link-container">
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
                <CustomizeGroupSelect
                  selectedOptions={this.state.selectedOptions}
                  options={this.state.groups}
                  onChange={this.onChange}
                  onDeleteOption={this.onDeleteOption}
                  searchPlaceholder={gettext('Select groups')}
                  noOptionsPlaceholder={gettext('No results')}
                  isInModal={true}
                />
              </td>
              <td>
                <ProjectSharePermissionEditor
                  isTextMode={false}
                  isEditIconShow={false}
                  currentPermission={this.state.permission}
                  customSharePermissions={this.props.customSharePermissions}
                  onPermissionChanged={this.setPermission}
                  onAddCustomSharePermission={this.props.onAddCustomSharePermission}
                />
              </td>
              <td>
                <Button className="w-100" onClick={this.addProjectShare}>{gettext('Submit')}</Button>
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
              {renderList}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

ShareProjectToGroup.propTypes = {
  currentProject: PropTypes.object.isRequired,
  onAddGroupSharedProject: PropTypes.func.isRequired,
  onLeaveGroupSharedProject: PropTypes.func.isRequired,
  customSharePermissions: PropTypes.array,
  onAddCustomSharePermission: PropTypes.func,
  srcGroupID: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  groupName: PropTypes.string,
};

export default ShareProjectToGroup;
