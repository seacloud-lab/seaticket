import React from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import UserSelect from '../../components/user-select';
import { gettext } from '../../constants';
import ModalHeader from '../../components/modal-header';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  addAdminInBatch: PropTypes.func.isRequired,
};

class SysAdminBatchAddAdminDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      options: null,
      isSubmitBtnActive: false
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  handleSelectChange = (options) => {
    this.setState({
      options: options,
      isSubmitBtnActive: options.length > 0
    });
  };

  handleSubmit = () => {
    this.props.addAdminInBatch(this.state.options.map(item => item.email));
    this.toggle();
  };

  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <ModalHeader toggle={this.toggle}>{gettext('Add admin')}</ModalHeader>
        <ModalBody>
          <UserSelect
            isMulti={true}
            className="reviewer-select"
            placeholder={gettext('Search users')}
            onSelectChange={this.handleSelectChange}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!this.state.isSubmitBtnActive}>{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

SysAdminBatchAddAdminDialog.propTypes = propTypes;

export default SysAdminBatchAddAdminDialog;
