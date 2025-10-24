import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Form, FormGroup, Input } from 'reactstrap';
import { ModalHeader } from '@/components';
import { gettext } from '../../../constants';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  updateLimit: PropTypes.func.isRequired
};

class SetAPICallsLimitPerUser extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      apiCallsLimitPerUser: '',
      isSubmitBtnActive: false
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  handleLimitChange = (e) => {
    const value = e.target.value.trim();
    this.setState({
      apiCallsLimitPerUser: value,
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
    this.props.updateLimit(this.state.apiCallsLimitPerUser);
    this.toggle();
  };

  render() {
    const { apiCallsLimitPerUser, isSubmitBtnActive } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Set API calls limit per user')}</ModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Input
                type="text"
                className="form-control"
                value={apiCallsLimitPerUser}
                onKeyPress={this.handleKeyPress}
                onChange={this.handleLimitChange}
              />
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

SetAPICallsLimitPerUser.propTypes = propTypes;

export default SetAPICallsLimitPerUser;
