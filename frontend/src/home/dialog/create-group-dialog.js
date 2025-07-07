import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Input, Button } from 'reactstrap';
import { toaster, ModalHeader } from '../../components';
import { gettext } from '../../constants';
import { seaQAAPI } from '../../api/web-api';
import { Utils } from '../../utils/utils';

class CreateGroupDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groupName: '',
      errorMsg: '',
      isSubmitBtnActive: false,
    };
  }

  toggle = () => {
    this.props.onToggle();
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
        this.props.onSubmit();
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
        <ModalHeader toggle={this.toggle} >{gettext('New group')}</ModalHeader>
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

CreateGroupDialog.propTypes = {
  onToggle: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default CreateGroupDialog;
