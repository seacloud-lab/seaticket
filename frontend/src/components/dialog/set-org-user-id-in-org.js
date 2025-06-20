import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../constants';
import { orgAdminServiceApi } from '../../api/org-admin-service-api';
import { Utils } from '../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  orgID: PropTypes.string.isRequired,
  email: PropTypes.string.isRequired,
  idInOrg: PropTypes.string.isRequired,
  updateIdInOrg: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired
};

class SetOrgUserIdInOrg extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      inputValue: this.props.idInOrg,
      submitBtnDisabled: false
    };
  }

  handleInputChange = (e) => {
    this.setState({
      inputValue: e.target.value
    });
  };

  formSubmit = () => {
    const { orgID, email } = this.props;
    const idInOrg = this.state.inputValue.trim();

    this.setState({
      submitBtnDisabled: true
    });

    orgAdminServiceApi.orgAdminSetOrgUserIdInOrg(orgID, email, idInOrg).then((res) => {
      this.props.updateIdInOrg(res.data.id_in_org);
      this.props.toggleDialog();
    }).catch((error) => {
      let errorMsg = Utils.getErrorMsg(error);
      this.setState({
        formErrorMsg: errorMsg,
        submitBtnDisabled: false
      });
    });
  };

  render() {
    const { inputValue, formErrorMsg, submitBtnDisabled } = this.state;
    return (
      <Modal isOpen={true} centered={true} toggle={this.props.toggleDialog}>
        <DTableModalHeader toggle={this.props.toggleDialog}>{gettext('Set user ID')}</DTableModalHeader>
        <ModalBody>
          <React.Fragment>
            <input type="text" className="form-control" value={inputValue} onChange={this.handleInputChange} />
            {formErrorMsg && <p className="error m-0 mt-2">{formErrorMsg}</p>}
          </React.Fragment>
        </ModalBody>
        <ModalFooter>
          <button className="btn btn-secondary" onClick={this.props.toggleDialog}>{gettext('Cancel')}</button>
          <button className="btn btn-primary" disabled={submitBtnDisabled} onClick={this.formSubmit}>{gettext('Submit')}</button>
        </ModalFooter>
      </Modal>
    );
  }
}

SetOrgUserIdInOrg.propTypes = propTypes;

export default SetOrgUserIdInOrg;
