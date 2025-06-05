import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody } from 'reactstrap';
import { toaster, DTableGroupSelect } from 'dtable-ui-component';
import { dtableWebAPI } from '../../../../api/dtable-web-api';
import { Utils } from '../../../../utils/utils';
import GroupItem from './group-item';
import { DTableModalHeader } from 'dtable-ui-component';

import '../../../../css/dtable-dataset.css';

const gettext = window.gettext;

class ShareWorkflowDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      sharedList: [],
      selectedGroups: [],
      groupResult: null,
    };
  }

  componentDidMount() {
    this.initSharedList();
  }

  initSharedList = async () => {
    const { appToken } = this.props;
    const groupResult = await dtableWebAPI.shareableGroups();
    const sharedResult = await dtableWebAPI.listWorkflowShares(appToken);
    this.setState({
      groupResult,
      sharedList: sharedResult.data.share_list,
    });
  };

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

  onShareToGroup = () => {
    let { sharedList } = this.state;
    let groupIdList = this.state.selectedGroups.map(group => group.value);
    dtableWebAPI.shareWorkflow(this.props.appToken, groupIdList).then(res => {
      let { failed_list, success_list } = res.data;
      let newSharedList = sharedList.slice();
      success_list.map(group => {
        newSharedList.push(group.group_info);
        return newSharedList;
      });
      this.setState({
        sharedList: newSharedList,
        selectedGroups: []
      });
      failed_list.forEach(failed => {
        toaster.danger(failed.error_msg);
      });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  onDeleteGroup = (groupId) => {
    let { sharedList } = this.state;
    dtableWebAPI.deleteWorkflowShare(this.props.appToken, groupId).then(() => {
      let newSharedList = sharedList.filter(item => item.group_id !== groupId);
      this.setState({ sharedList: newSharedList });
    }).catch((error) => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  renderSelectContainer = () => {
    const { selectedGroups, groupResult } = this.state;
    const isDesktop = Utils.isDesktop();
    const disabled = !Array.isArray(selectedGroups) || selectedGroups.length === 0;

    const { dtableGroupId } = this.props;
    const validDtableGroupId = dtableGroupId ? Number(dtableGroupId) : '';

    let shareableGroupOptions = [];
    if (groupResult) {
      shareableGroupOptions = groupResult.data.map(group => {
        return {
          value: group.id,
          id: group.id,
          name: group.name,
          label: group.name,
        };
      }).filter(group => group.value !== validDtableGroupId);
    }

    return (
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
                options={shareableGroupOptions}
                onSelectOption={this.onSelectOption}
                onDeleteOption={this.onDeleteOption}
                searchPlaceholder={gettext('Select groups')}
                noOptionsPlaceholder={gettext('No results')}
                isInModal={true}
              />
            </td>
            <td>
              <Button className="w-100" onClick={this.onShareToGroup} disabled={disabled}>{gettext('Submit')}</Button>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  renderGroupListContainer = () => {
    const { sharedList } = this.state;
    return (
      <div className="dtable-common-dataset-group-access">
        {sharedList && sharedList.length > 0 &&
          <table>
            <thead>
              <tr>
                <th width="92%">{gettext('Group name')}</th>
                <th width="8%"/>
              </tr>
            </thead>
            <tbody>
              {sharedList.map((group, index) => {
                return <GroupItem key={index} group={group} deleteGroup={this.onDeleteGroup} />;
              })}
            </tbody>
          </table>
        }
      </div>
    );
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.props.shareCancel}>
        <DTableModalHeader toggle={this.props.shareCancel}>{gettext('Manage permissions')}</DTableModalHeader>
        <ModalBody className="dtable-common-dataset-access">
          {this.renderSelectContainer()}
          {this.renderGroupListContainer()}
        </ModalBody>
      </Modal>
    );
  }
}

ShareWorkflowDialog.propTypes = {
  workflowName: PropTypes.string.isRequired,
  appToken: PropTypes.string,
  dtableGroupId: PropTypes.string,
  shareCancel: PropTypes.func.isRequired,
};

export default ShareWorkflowDialog;
