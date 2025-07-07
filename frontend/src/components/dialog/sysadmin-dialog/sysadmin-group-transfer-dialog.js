import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { Utils } from '../../../utils/utils';
import { gettext } from '../../../constants';
import SysAdminUserSelect from '../../select-editor/sysadmin-user-select';
import ModalHeader from '../../modal-header';

const propTypes = {
  transferGroup: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired,
  item: PropTypes.object.isRequired,
};

class SysAdminTransferGroupDialog extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      selectedOption: null,
      submitBtnDisabled: true
    };
  }

  handleSelectChange = (option) => {
    this.setState({
      selectedOption: option,
      submitBtnDisabled: option == null
    });
  };

  submit = () => {
    const receiver = this.state.selectedOption.email;
    this.props.transferGroup(receiver);
    this.props.toggleDialog();
  };

  render() {
    const { submitBtnDisabled } = this.state;
    let { item } = this.props;
    let orgID = item.org_id ? item.org_id : -1;
    let groupName = Utils.HTMLescape(item.name);

    const innerSpan = '<span class="op-target" title=' + groupName + '>' + groupName + '</span>';
    const msg = gettext('Transfer group {library_name} to').replace('{library_name}', innerSpan);
    return (
      <Modal isOpen={true} toggle={this.props.toggleDialog}>
        <ModalHeader toggle={this.props.toggleDialog}>
          <span dangerouslySetInnerHTML={{ __html: msg }}></span>
        </ModalHeader>
        <ModalBody>
          <SysAdminUserSelect
            ref="userSelect"
            isMulti={false}
            className="reviewer-select"
            placeholder={gettext('Select a user')}
            onSelectChange={this.handleSelectChange}
            orgID={orgID}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.props.toggleDialog}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.submit} disabled={submitBtnDisabled}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminTransferGroupDialog.propTypes = propTypes;

export default SysAdminTransferGroupDialog;
