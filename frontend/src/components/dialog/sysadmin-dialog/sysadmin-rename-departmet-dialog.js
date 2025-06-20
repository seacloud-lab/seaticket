import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Modal, ModalBody, ModalFooter, Input, Form, FormGroup, Label } from 'reactstrap';
import { gettext } from '../../../constants';
import { Utils, validateName } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  groupID: PropTypes.string.isRequired,
  groupName: PropTypes.string,
  toggle: PropTypes.func.isRequired,
  onDepartChanged: PropTypes.func.isRequired,
};

class RenameDepartmentDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      groupID: this.props.groupID,
      departName: this.props.groupName,
      errMessage: '',
      isSubmitBtnActive: false,
    };
  }

  handleSubmit = () => {
    let response = validateName(this.state.departName);
    if (!response.isValid) {
      this.setState({ errMessage: response.message });
      return;
    }
    sysAdminServiceApi.sysAdminUpdateDepartGroup(this.state.groupID, response.message).then((res) => {
      this.props.toggle();
      this.props.onDepartChanged();
    }).catch(error => {
      let errorMsg = Utils.getErrorMsg(error);
      this.setState({ errMessage: errorMsg });
    });
  };

  handleChange = (e) => {
    const value = e.target.value.trim();
    if (value === this.props.groupName) {
      this.setState({
        departName: value,
        isSubmitBtnActive: false
      });
      return;
    }
    this.setState({
      departName: value,
      isSubmitBtnActive: value !== ''
    });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { isSubmitBtnActive, errMessage } = this.state;
    return (
      <Modal isOpen={true} toggle={this.props.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Rename')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label for="departName">{gettext('Name')}</Label>
              <Input
                id="departName"
                onKeyDown={this.onKeyDown}
                value={this.state.departName}
                onChange={this.handleChange}
                autoFocus
              />
            </FormGroup>
          </Form>
          {errMessage && <Alert color="danger">{errMessage}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

RenameDepartmentDialog.propTypes = propTypes;

export default RenameDepartmentDialog;
