import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import ModalPortal from '../../../components/modal-portal';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import Loading from '../../../components/loading';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  deleteCancel: PropTypes.func.isRequired,
  onDeleteInvalidArchives: PropTypes.func.isRequired,
  deleteLoading: PropTypes.bool,
};

class DeleteInvalidArchivesDialog extends React.Component {

  toggle = () => {
    this.props.deleteCancel();
  };

  render() {
    let { deleteLoading } = this.props;
    return (
      <ModalPortal>
        <Modal isOpen={true} toggle={this.toggle}>
          <DTableModalHeader toggle={this.toggle}>{gettext('Delete archives')}</DTableModalHeader>
          <ModalBody>
            <p>{gettext('Are you sure to delete archives of deleted bases in current page?')}</p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onMouseDown={this.toggle}>{gettext('Cancel')}</Button>
            <Button color="primary" onMouseDown={this.props.onDeleteInvalidArchives} className="delete-archives-confirm-btn">
              {deleteLoading ?
                <Loading /> :
                gettext('Delete')
              }
            </Button>
          </ModalFooter>
        </Modal>
      </ModalPortal>
    );
  }
}

DeleteInvalidArchivesDialog.propTypes = propTypes;

export default DeleteInvalidArchivesDialog;
