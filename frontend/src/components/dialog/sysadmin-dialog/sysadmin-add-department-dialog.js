import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Modal, ModalBody, ModalFooter, Input, Form, FormGroup, Label } from 'reactstrap';
import { gettext } from '../../../constants';
import { validateName } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';
import { sysAdminServiceApi } from '../../../api/sys-admin-service-api';

const propTypes = {
  groupID: PropTypes.string,
  parentGroupID: PropTypes.string,
  toggle: PropTypes.func.isRequired,
  onDepartChanged: PropTypes.func.isRequired,
};

class AddDepartDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      departName: '',
      errMessage: '',
    };
  }

  handleSubmit = () => {
    let response = validateName(this.state.departName);
    if (!response.isValid) {
      this.setState({ errMessage: response.message });
      return;
    }
    let parentGroup = this.props.parentGroupID || -1;
    sysAdminServiceApi.sysAdminAddDepartGroup(response.message, parentGroup).then((res) => {
      this.props.toggle();
      this.props.onDepartChanged();
    }).catch(error => {
      let errorMsg = gettext(error.response.data.error_msg);
      this.setState({ errMessage: errorMsg });
    });
  };

  handleChange = (e) => {
    this.setState({
      departName: e.target.value,
    });
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  render() {
    const { errMessage } = this.state;
    let header = this.props.parentGroupID ? gettext('New sub-department') : gettext('New department');
    return (
      <Modal isOpen={true} toggle={this.props.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.props.toggle}>{header}</DTableModalHeader>
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
          <Button color="primary" onClick={this.handleSubmit}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

AddDepartDialog.propTypes = propTypes;

export default AddDepartDialog;
