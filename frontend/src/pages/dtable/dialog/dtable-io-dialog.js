import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../../utils/constants';
import { Modal, ModalBody, ModalFooter, Button } from 'reactstrap';
import Loading from '../../../components/loading';
import { DTableModalHeader } from 'dtable-ui-component';

import '../css/dtable-io-dialog.css';

const propTypes = {
  isExporting: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  cancelDTableIOTask: PropTypes.func.isRequired,
  canCancelIOTask: PropTypes.bool,
  isParsing: PropTypes.bool,
};

class DTableIODialog extends React.Component {

  static defaultProps = {
    canCancelIOTask: true
  };

  toggle = () => {
    this.props.toggle();
  };

  render() {
    const { isExporting, isParsing, canCancelIOTask } = this.props;
    let importMsg = gettext('Import file');
    let exportMsg = gettext('Export file');
    return (
      <Modal className="dtable-io-dialog" isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{`${isExporting ? exportMsg : importMsg}`}</DTableModalHeader>
        <ModalBody>
          <>
            <Loading/>
            {isParsing &&
              <div className="dtable-io-dialog-parsing-text">{gettext('Parsing file...')}</div>
            }
          </>
        </ModalBody>
        {canCancelIOTask &&
          <ModalFooter>
            <Button color="secondary" onClick={this.props.cancelDTableIOTask}>{gettext('Cancel')}</Button>
          </ModalFooter>
        }
      </Modal>
    );
  }
}

DTableIODialog.propTypes = propTypes;

export default DTableIODialog;
