import React from 'react';
import PropTypes from 'prop-types';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../constants';
import { seaQAAPI } from '../../../api/web-api';
import { Modal, ModalBody, ModalFooter, Input, Button } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggleAddGroupModal: PropTypes.func.isRequired,
  onCreateGroup: PropTypes.func.isRequired,
};

class CreateDtableGroupDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groupName: '',
      errorMsg: '',
      isSubmitBtnActive: false,
    };
  }

  toggle = () => {
    this.props.toggleAddGroupModal();
  };

  handleGroupChange = (event) => {
    let name = event.target.value;

    if (!name.trim()) {
      this.setState({ isSubmitBtnActive: false });
    } else {
      this.setState({ isSubmitBtnActive: true });
    }
    this.setState({
      groupName: name
    });
    if (this.state.errorMsg) {
      this.setState({
        errorMsg: ''
      });
    }
  };

  handleSubmit = () => {
    let name = this.state.groupName.trim();
    if (name) {
      seaQAAPI.createGroup(name).then((res) => {
        this.props.onCreateGroup();
      }).catch((error) => {
        let errMsg = Utils.getErrorMsg(error, true);
        if (!error.response || error.response.status !== 403) {
          toaster.danger(errMsg);
        }
      });
    } else {
      this.setState({
        errorMsg: gettext('Name is required')
      });
    }
    this.setState({
      groupName: '',
    });
  };

  handleKeyDown = (e) => {
    if (e.keyCode === 13) {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.toggle} >{gettext('New group')}</DTableModalHeader>
        <ModalBody>
          <label htmlFor="groupName">{gettext('Name')}</label>
          <Input
            type="text"
            id="groupName"
            value={this.state.groupName}
            onChange={this.handleGroupChange}
            onKeyDown={this.handleKeyDown}
            autoFocus
          />
          <span className="error">{this.state.errorMsg}</span>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CreateDtableGroupDialog.propTypes = propTypes;

export default CreateDtableGroupDialog;
