import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, Label } from 'reactstrap';
import { gettext } from '@/constants/config';
import homeAPI from '../api';
import { Utils } from '@/utils/utils';
import { ModalHeader, toaster } from '@/components';

const propTypes = {
  groupID: PropTypes.number.isRequired,
  renameGroupName: PropTypes.func.isRequired,
  onRenameGroupToggle: PropTypes.func.isRequired,
  currentGroupName: PropTypes.string.isRequired,
};

class RenameGroupNameDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      newGroupName: this.props.currentGroupName,
      isSubmitBtnActive: false,
    };
  }

  handleGroupNameChange = (event) => {
    if (!event.target.value.trim()) {
      this.setState({ isSubmitBtnActive: false });
    } else {
      this.setState({ isSubmitBtnActive: true });
    }

    let name = event.target.value;
    this.setState({
      newGroupName: name
    });
  };

  renameGroup = () => {
    let name = this.state.newGroupName.trim();
    if (name) {
      homeAPI.renameGroup(this.props.groupID, name).then((res) => {
        this.props.renameGroupName();
      }).catch(error => {
        let errMsg = Utils.getErrorMsg(error, true);
        if (!error.response || error.response.status !== 403) {
          toaster.danger(errMsg);
        }
      });
    }
    this.setState({
      newGroupName: '',
    });
    this.props.onRenameGroupToggle();
  };

  toggle = () => {
    this.props.onRenameGroupToggle();
  };

  handleKeyDown = (event) => {
    if (event.keyCode === 13) {
      this.renameGroup();
    }
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle} autoFocus={false}>
        <ModalHeader toggle={this.toggle}>{gettext('Rename group')}</ModalHeader>
        <ModalBody>
          <Label for="newGroupName">{gettext('Rename group to')}</Label>
          <Input
            type="text"
            id="newGroupName"
            value={this.state.newGroupName}
            onChange={this.handleGroupNameChange}
            onKeyDown={this.handleKeyDown}
            autoFocus
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.renameGroup} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

RenameGroupNameDialog.propTypes = propTypes;

export default RenameGroupNameDialog;
