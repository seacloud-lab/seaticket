import React from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../constants';
import { Utils } from '../../../utils/utils';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  selectedDirentList: PropTypes.array.isRequired,
  deleteCancel: PropTypes.func.isRequired,
  batchDeleteFile: PropTypes.func.isRequired,
};

class BatchDeleteAssetFilesDialog extends React.Component {

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
  }
  
  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
  }

  onKeyDown = (e) => {
    if (e.which === Utils.keyCodes.enter) {
      this.props.batchDeleteFile();
    }
  };

  toggle = () => {
    this.props.deleteCancel();
  };

  renderInfo = () => {
    const len = this.props.selectedDirentList.length;
    let message = '';
    if (len === 1) {
      message = gettext('Are you sure to delete %s folder or file?');
    } else {
      message = gettext('Are you sure to delete %s folders or files?'); 
    }
    message = message.replace('%s', len);
    return (
      <p>{message}</p>
    );
  };
  
  render() {
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{gettext('Delete items')}</DTableModalHeader>
        <ModalBody>{this.renderInfo()}</ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.props.batchDeleteFile}>{gettext('Delete')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

BatchDeleteAssetFilesDialog.propTypes = propTypes;

export default BatchDeleteAssetFilesDialog;
