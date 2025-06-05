import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import { gettext } from '../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  toggle: PropTypes.func.isRequired,
  onConfirmExportDTable: PropTypes.func,
  sizeLimit: PropTypes.number,
};

class ConfirmDTableExportDialog extends Component {

  constructor(props) {
    super(props);
  }

  confirm = () => {
    let ignoreAsset = 'true';
    this.props.onConfirmExportDTable(ignoreAsset);
    this.props.toggle();
  };

  render() {
    const { toggle, sizeLimit } = this.props;
    return (
      <Modal isOpen={true} toggle={toggle} size="md" className="dtable-set-password-dialog">
        <DTableModalHeader toggle={this.props.toggle}>
          <span className="mr-1">{gettext('Export base')}</span>
        </DTableModalHeader>
        <ModalBody className='pb-0'>
          <p>{gettext('The assets in the base exceed the limit of {sizeLimit} MB. You can choose to export the base without assets.').replace('{sizeLimit}', sizeLimit)}</p>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.confirm}>{gettext('Export without assets')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

ConfirmDTableExportDialog.propTypes = propTypes;

export default ConfirmDTableExportDialog;
