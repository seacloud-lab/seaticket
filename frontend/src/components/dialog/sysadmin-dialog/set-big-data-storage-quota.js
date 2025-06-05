import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Input, InputGroup, InputGroupText } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  updateQuota: PropTypes.func.isRequired
};

class SetBigDataStorageQuotaDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      quota: '',
      isSubmitBtnActive: false
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  handleQuotaChange = (e) => {
    const value = e.target.value.trim();
    this.setState({
      quota: value,
      isSubmitBtnActive: value !== ''
    });
  };

  handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      this.handleSubmit();
      e.preventDefault();
    }
  };

  handleSubmit = () => {
    this.props.updateQuota(this.state.quota);
    this.toggle();
  };

  render() {
    const { quota, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Set quota')}</DTableModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <InputGroup>
                <Input
                  type="text"
                  className="form-control"
                  value={quota}
                  onKeyPress={this.handleKeyPress}
                  onChange={this.handleQuotaChange}
                />
                <InputGroupText>MB</InputGroupText>
              </InputGroup>
              <p className="small text-secondary mt-2 mb-2">
                {gettext('An integer that is greater than or equal to 0.')}
                <br />
                {gettext('Tip: 0 means default limit')}
              </p>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SetBigDataStorageQuotaDialog.propTypes = propTypes;

export default SetBigDataStorageQuotaDialog;
