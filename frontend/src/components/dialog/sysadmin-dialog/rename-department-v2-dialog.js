import React from 'react';
import PropTypes from 'prop-types';
import { Button, Form, FormGroup, Input, Label, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { toaster } from 'dtable-ui-component';
import { gettext } from '../../../constants';
import { Utils, validateName } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  node: PropTypes.object,
  renameDepartment: PropTypes.func,
  toggle: PropTypes.func
};

class RenameDepartmentV2Dialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      departName: props.node.name,
      isSubmitBtnActive: false
    };
  }

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  handleChange = (e) => {
    const value = e.target.value;
    this.setState({
      departName: value
    }, () => {
      this.setState({ isSubmitBtnActive: !!this.state.departName.trim() });
    });
  };

  handleSubmit = () => {
    let response = validateName(this.state.departName.trim());
    if (!response.isValid) {
      this.setState({ errMessage: response.message });
      return;
    }
    const { node } = this.props;
    sysAdminServiceApi.sysAdminUpdateAddressBookV2DepartmentName(node.id, response.message).then((res) => {
      this.props.renameDepartment(node, res.data.department);
      this.props.toggle();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
    });
  };

  render() {
    const { isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.props.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.props.toggle}>{gettext('Rename')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label for="departmentName">{gettext('Name')}</Label>
              <Input
                id="departmentName"
                onKeyDown={this.onKeyDown}
                value={this.state.departName}
                onChange={this.handleChange}
                autoFocus
              />
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

RenameDepartmentV2Dialog.propTypes = propTypes;

export default RenameDepartmentV2Dialog;
