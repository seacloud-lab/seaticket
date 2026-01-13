import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter, Label, Input, Form, FormGroup } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader } from '@/components';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

class InviteUserDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      emailsText: '',
      errMessage: '',
      isSubmitting: false,
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  onChangeEmails = (e) => {
    this.setState({ emailsText: e.target.value });
  };

  submit = () => {
    const { emailsText } = this.state;
    const list = emailsText
      .split(/[\s,;]+/)
      .map(x => x.trim())
      .filter(x => x.length > 0);
    if (list.length === 0) {
      this.setState({ errMessage: gettext('Email is required') });
      return;
    }
    this.setState({ isSubmitting: true, errMessage: '' });
    this.props.handleSubmit(list);
  };

  render() {
    const { emailsText, errMessage, isSubmitting } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Invite user')}</ModalHeader>
        <ModalBody>
          <Form>
            <FormGroup>
              <Label>{gettext('You can enter multiple emails, each will receive an invitation link.')}</Label>
              <br />
              <Label>{gettext('Email')}</Label>
              <Input
                type="textarea"
                rows="4"
                value={emailsText}
                onChange={this.onChangeEmails}
                placeholder={gettext('Enter emails separated by comma, space, or newline')}
              />
            </FormGroup>
          </Form>
          {errMessage && <Label className="err-message">{errMessage}</Label>}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" disabled={isSubmitting} onClick={this.submit} className={isSubmitting ? 'btn-loading' : ''}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}

InviteUserDialog.propTypes = propTypes;

export default InviteUserDialog;
