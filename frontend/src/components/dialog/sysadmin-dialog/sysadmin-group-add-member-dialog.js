import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../constants';
import SysAdminUserSelect from '../../select-editor/sysadmin-user-select';
import ModalHeader from '../../modal-header';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  addMembers: PropTypes.func.isRequired,
  orgID: PropTypes.number.isRequired,
};

class SysAdminGroupAddMemberDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOptions: null,
      isSubmitBtnDisabled: true
    };
  }

  handleSelectChange = (options) => {
    const isSubmitBtnDisabled = Array.isArray(options) && options.length === 0;
    this.setState({
      selectedOptions: options,
      isSubmitBtnDisabled,
    });
  };

  addMembers = () => {
    let emails = this.state.selectedOptions.map(item => item.email);
    this.props.addMembers(emails);
    this.props.toggle();
  };

  render() {
    const { isSubmitBtnDisabled } = this.state;
    const { orgID } = this.props;
    return (
      <Modal isOpen={true} toggle={this.props.toggle}>
        <ModalHeader toggle={this.props.toggle}>{gettext('Add member')}</ModalHeader>
        <ModalBody>
          <SysAdminUserSelect
            isMulti={true}
            className="reviewer-select"
            placeholder={gettext('Search users')}
            onSelectChange={this.handleSelectChange}
            orgID={orgID}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.addMembers} disabled={isSubmitBtnDisabled}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminGroupAddMemberDialog.propTypes = propTypes;

export default SysAdminGroupAddMemberDialog;
