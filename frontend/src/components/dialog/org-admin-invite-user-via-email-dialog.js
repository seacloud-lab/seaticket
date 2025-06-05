import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Input, ModalBody, ModalFooter, Form, FormGroup, Alert } from 'reactstrap';
import { isValidEmail } from 'dtable-utils';
import { toaster, DTableModalHeader } from 'dtable-ui-component';
import { gettext, orgID } from '../../utils/constants';
import { Utils } from '../../utils/utils';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';

import '../../css/org-admin-invite-user-via-email-dialog.css';

const propTypes = {
  toggle: PropTypes.func.isRequired,
};

class InviteUserViaEmailDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errMessage: '',
      isAddingUser: false,
      emails: ['', ''],
    };
  }

  handleSubmit = () => {
    let isValid = this.validateInputParams();
    if (!isValid) return;
    let { emails } = this.state;
    let newEmails = Array.from(new Set(emails)).filter(email => email !== '');
    this.setState({isAddingUser: true});
    orgAdminServiceApi.orgAdminInviteOrgUser(orgID, newEmails).then(res => {
      let successCount = res.data.success_list.length;
      let failedCount = res.data.failed_list.length;
      let duplicateCount = res.data.duplicate_list.length;
      if (newEmails.length === 1) {
        if (successCount === 1) {
          // send to one and success
          toaster.success(gettext('Sent invitation to {email}').replace('{email}', newEmails[0]));
        } else {
          // send to one but failed
          if (duplicateCount === 1) {
            toaster.danger(gettext('Faild to sent invitation. {email} is already registered').replace('{email}', newEmails[0]));
          } else {
            toaster.danger(gettext('Faild to sent invitation')); // this wiil not happen, api errs will toast in catch
          }
        }
      } else {
        let duplcateEmailsString = res.data.duplicate_list.join(', ');
        if (successCount === 0) {
          toaster.danger(gettext('All emails failed to send'));
          if (duplicateCount > 0) {
            if (duplicateCount === 1) {
              toaster.danger(gettext('{email} is already registered').replace('{email}', newEmails[0]));
            } else {
              toaster.danger(gettext('{emails} are already registered.').replace('{emails}', duplcateEmailsString));
            }
          }
        } else {
          let msg;
          if (failedCount > 0) {
            msg = gettext('Sent {successCount} invitation email(s), {failedCount} failed to send').replace('{successCount}', successCount).replace('{failedCount}', failedCount);
          } else {
            msg = gettext('Sent {successCount} invitation email(s)').replace('{successCount}', successCount);
          }
          toaster.success(msg);
          if (duplicateCount > 0) {
            if (duplicateCount === 1) {
              toaster.danger(gettext('{email} is already registered').replace('{email}', newEmails[0]));
            } else {
              toaster.danger(gettext('{emails} are already registered.').replace('{emails}', duplcateEmailsString));
            }
          }
        }
      }
      this.props.toggle();
    }).catch(error => {
      let errMessage = Utils.getErrorMsg(error);
      toaster.danger(errMessage);
      this.props.toggle();
    });
  } 

  inputEmail = (e, idx) => {
    let email = e.target.value.trim();
    let oldEmails = this.state.emails;
    oldEmails[idx] = email;
    this.setState({emails: oldEmails, errMessage: ''});
  };

  toggle = () => {
    this.props.toggle();
  };

  onFocus = (idx) => {
    let { emails } = this.state;
    if (idx === emails.length -1) {
      emails.push('');
      this.setState({emails});
    }
  };

  onDeleteInviteInput = (idx) => {
    let { emails } = this.state;
    emails.splice(idx, 1);
    this.setState({emails});
  };

  validateInputParams() {
    let errMessage;
    let { emails } = this.state;
    emails = emails.filter(email => email !== '');
    if (!emails.length) {
      errMessage = gettext('email required');
      this.setState({errMessage: errMessage});
      return false;
    }
    for (let email of emails) {
      if (!isValidEmail(email)) {
        errMessage = gettext('email invalid');
        this.setState({errMessage: errMessage});
        return false;
      }
    }
    return true;
  }

  renderOneEmail = (idx) => {
    return (
      <FormGroup>
        <div className="org-invitation-container">
          <span>{gettext('Email')}</span>
          {idx > 1 && 
            <span className="delete-invitation-input" onClick={this.onDeleteInviteInput.bind(this, idx)}>{gettext('Delete')}</span>
          }
        </div>
        <Input value={this.state.emails[idx] || ''} onFocus={this.onFocus.bind(this, idx)} onChange={e => {this.inputEmail(e, idx);}} />
      </FormGroup>
    );
  };

  render() {
    const { emails } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle} className="invite-user-email-dialog">
        <DTableModalHeader toggle={this.toggle}>{gettext('Invite user')}</DTableModalHeader>
        <ModalBody className="invite-user-email-body">
          <Form>
            {emails.map((item, index) => {
              return <div key={index}>{this.renderOneEmail(index)}</div>;
            })}
          </Form>
          {this.state.errMessage && <Alert color="danger">{this.state.errMessage}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color="primary" disabled={this.state.isAddingUser} onClick={this.handleSubmit} className={this.state.isAddingUser ? 'btn-loading' : ''}>{gettext('Invite')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

InviteUserViaEmailDialog.propTypes = propTypes;

export default InviteUserViaEmailDialog;
