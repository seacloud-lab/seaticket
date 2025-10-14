import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { toaster, ModalHeader } from '@/components';
import { gettext } from '@/constants';
import { Utils } from '@/utils/utils';
import GroupSelect from '@/components/group-select';
import sysAdminAPI from '@/sys-admin/api';

const propTypes = {
  title: PropTypes.string,
  email: PropTypes.string,
  groupList: PropTypes.array,
  addToGroups: PropTypes.func
};

class AddUserToGroupsOperation extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowDialog: false,
      isAdding: false,
      selectedGroupIds: []
    };
  }

  toggleDialog = () => {
    this.setState({ isShowDialog: !this.state.isShowDialog });
  };

  handleSubmit = () => {
    this.setState({ isAdding: true });
    const { email } = this.props;
    const { selectedGroupIds } = this.state;
    sysAdminAPI.sysAdminAddUserToGroups(email, selectedGroupIds).then((res) => {
      const { success, failed } = res.data;
      success.forEach(group => {
        toaster.success(gettext('Added to {placeholder}').replace('{placeholder}', group.name));
      });
      failed.forEach(item => {
        toaster.danger(item.error_msg);
      });
      this.setState({ isAdding: false });
      this.props.addToGroups(success);
      this.toggleDialog();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.setState({ isAdding: false });
    });
  };

  loadOptions = (input, callback) => {
    const value = input.trim();
    const { groupList } = this.props;
    if (value.length > 0) {
      sysAdminAPI.sysAdminSearchGroups(value).then((res) => {
        this.options = [];
        for (let i = 0 ; i < res.data.group_list.length; i++) {
          const item = res.data.group_list[i];
          const group = groupList.find(group => group.id === item.id);
          if (group) continue;
          let obj = {};
          obj.value = item.name;
          obj.group_id = item.id;
          obj.label =
            <React.Fragment>
              <span className='select-module select-module-name'>{item.name}</span>
            </React.Fragment>;
          this.options.push(obj);
        }
        callback(this.options);
      }).catch(error => {
        let errMessage = Utils.getErrorMsg(error);
        toaster.danger(errMessage);
      });
    }
  };

  onSelectChange = (option) => {
    this.setState({
      selectedGroupIds: option ? option.map(item => item.group_id) : [],
      errMessage: []
    });
  };

  render() {
    const { isShowDialog, isAdding } = this.state;
    const { title } = this.props;

    const btnProps = {
      className: 'btn btn-secondary operation-item',
      title: title,
      'aria-label': title,
      onClick: this.toggleDialog
    };

    return (
      <>
        <button {...btnProps}>{title}</button>
        {isShowDialog && (
          <Modal isOpen={true} toggle={this.toggleDialog}>
            <ModalHeader toggle={this.toggleDialog}>
              {gettext('Add user to groups')}
            </ModalHeader>
            <ModalBody>
              <GroupSelect
                placeholder={gettext('Search groups')}
                onSelectChange={this.onSelectChange}
                ref="groupSelect"
                isMulti={true}
                loadOptions={this.loadOptions}
              />
            </ModalBody>

            <ModalFooter>
              <Button color="secondary" onClick={this.toggleDialog}>{gettext('Cancel')}</Button>
              <Button color="primary" disable={isAdding} onClick={this.handleSubmit}>{gettext('Submit')}</Button>
            </ModalFooter>
          </Modal>
        )}
      </>
    );
  }
}

AddUserToGroupsOperation.propTypes = propTypes;

export default AddUserToGroupsOperation;
