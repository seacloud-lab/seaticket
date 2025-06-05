import React from 'react';
import PropTypes from 'prop-types';
import { DTableGroupSelect, toaster } from 'dtable-ui-component';
import { Button, Modal, ModalBody, Alert } from 'reactstrap';
import { dtableWebAPI } from '../../../api/dtable-web-api';
import { gettext } from '../../../utils/constants';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

class DatasetAccessGroupDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      accessGroupList: [],
      selectedGroups: [],
      isLoading: true
    };
    this.shareableGroupOptions = [];
  }

  componentDidMount() {
    let { publishGroupId } = this.props;
    dtableWebAPI.listDatasetAccessibleGroups(this.props.datasetId).then(res => {
      this.setState({
        accessGroupList: res.data.accessible_group_list
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
    dtableWebAPI.listShareableGroups().then((res) => {
      for (let i = 0 ; i < res.data.length; i++) {
        let obj = {};
        obj.value = res.data[i].name;
        obj.id = res.data[i].id;
        obj.label = res.data[i].name;
        obj.name = res.data[i].name;
        if (res.data[i].id !== publishGroupId) {
          this.shareableGroupOptions.push(obj);
        }
      }
      this.setState({ isLoading: false });
    }).catch(error => {
      this.setState({ isLoading: false });
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  }

  onSelectOption = (option) => {
    const selectedGroups = this.state.selectedGroups.slice(0);
    const index = selectedGroups.findIndex(item => item.id === option.id);
    if (index > -1) {
      selectedGroups.splice(index, 1);
    } else {
      selectedGroups.push(option);
    }
    this.setState({ selectedGroups: selectedGroups });
  };

  onDeleteOption = (option) => {
    const selectedGroups = this.state.selectedGroups.slice(0);
    const index = selectedGroups.findIndex(item => item.id === option.id);
    if (index > -1) {
      selectedGroups.splice(index, 1);
    }
    this.setState({ selectedGroups: selectedGroups });
  };

  addGroup = () => {
    let groupIdList = this.state.selectedGroups.map(selectedGroup => selectedGroup.id);
    dtableWebAPI.addDatasetAccessibleGroup(this.props.datasetId, groupIdList).then(res => {
      const { success_list, failed_list } = res.data;
      let failedGroups = [];
      if (failed_list.length > 0) {
        let failedGroupIds = failed_list.map(failedGroup => {
          return failedGroup.failed_group_id;
        });
        failedGroups = failedGroupIds.map(id => {
          return this.state.selectedGroups.find(selectedGroup => selectedGroup.id === id);
        });
      }

      this.setState({
        accessGroupList: this.state.accessGroupList.concat(success_list),
        selectedGroups: [],
      });
      if (failed_list.length === 0) {
        let errMsg = gettext('{success_count} group added.');
        errMsg = errMsg.replace('{success_count}', success_list.length);
        toaster.success(errMsg);
      } else {
        let errMsg = gettext('Failed to add group {group_names}.');
        let groupNames = failedGroups.map(failedGroup => {
          return failedGroup.value;
        });
        groupNames = groupNames.join(',');
        errMsg = errMsg.replace('{group_names}', groupNames);
        toaster.danger(errMsg);
      }
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  deleteGroup = (groupID) => {
    dtableWebAPI.deleteDatasetAccessibleGroup(this.props.datasetId, groupID).then(res => {
      this.setState({
        accessGroupList: this.state.accessGroupList.filter(group => group.group_id !== groupID)
      });
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const isDesktop = Utils.isDesktop();
    let { accessGroupList, errMessage, selectedGroups } = this.state;
    const disabled = !Array.isArray(selectedGroups) || selectedGroups.length === 0;

    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Manage permissions')}</DTableModalHeader>
        <ModalBody className="dtable-common-dataset-access">
          <table>
            <thead>
              <tr>
                <th width={isDesktop ? '77%' : '65%'}>{gettext('Grant access to group')}</th>
                <th width={isDesktop ? '23%' : '35%'}/>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <DTableGroupSelect
                    selectedOptions={selectedGroups}
                    options={this.shareableGroupOptions}
                    onSelectOption={this.onSelectOption}
                    onDeleteOption={this.onDeleteOption}
                    searchPlaceholder={gettext('Select groups')}
                    noOptionsPlaceholder={gettext('No results')}
                    isInModal={true}
                  />
                </td>
                <td>
                  <Button className="w-100" onClick={this.addGroup} disabled={disabled}>{gettext('Add')}</Button>
                </td>
              </tr>
            </tbody>
          </table>
          {errMessage && <Alert color="danger" className="mt-2">{errMessage}</Alert>}
          <div className="dtable-common-dataset-group-access">
            {accessGroupList && accessGroupList.length > 0 &&
              <table>
                <thead>
                  <tr>
                    <th width="92%">{gettext('Group name')}</th>
                    <th width="8%"/>
                  </tr>
                </thead>
                <tbody>
                  {
                    accessGroupList.map((group, index) => {
                      return (<GroupItem key={index} group={group} deleteGroup={this.deleteGroup}/>);
                    })
                  }
                </tbody>
              </table>
            }
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

const propTypes = {
  datasetId: PropTypes.number.isRequired,
  toggle: PropTypes.func.isRequired,
  publishGroupId: PropTypes.number.isRequired,
};

DatasetAccessGroupDialog.propTypes = propTypes;


class GroupItem extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDelete: false,
    };
  }

  onMouseOver = () => {
    this.setState({ isShowDelete: !this.state.isShowDelete });
  };

  deleteGroup = () => {
    const group = this.props.group;
    if (group && group.group_id) {
      this.props.deleteGroup(group.group_id);
    }
  };

  render() {
    let { group } = this.props;
    return (
      <tr onMouseOver={this.onMouseOver} onMouseOut={this.onMouseOver}>
        {!group.is_deleted && <td>{group.group_name}</td>}
        {group.is_deleted && <td>{group.group_name}<span style={{ color: 'red' }}>{' (' + gettext('Deleted') + ')'}</span></td>}
        <td>
          <span
            className={`dtable-font dtable-icon-x action-icon ${this.state.isShowDelete ? '' : 'hide'}`}
            onClick={this.deleteGroup}
            title={gettext('Delete')}
            aria-label={gettext('Delete')}
          />
        </td>
      </tr>
    );
  }
}

const GroupItemPropTypes = {
  group: PropTypes.object.isRequired,
  deleteGroup: PropTypes.func.isRequired
};

GroupItem.propTypes = GroupItemPropTypes;

export default DatasetAccessGroupDialog;
