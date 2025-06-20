import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Input, Modal, ModalBody, ModalFooter } from 'reactstrap';
import { gettext } from '../../../constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  dataset: PropTypes.object,
  toggle: PropTypes.func,
  submit: PropTypes.func
};

class RenameDatasetDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      datasetName: props.dataset.dataset_name,
      errorMsg: '',
    };
  }

  toggle = () => {
    this.props.toggle();
  };

  onChangeDatasetName = (e) => {
    this.setState({ datasetName: e.target.value });
  };

  submit = () => {
    let datasetName = this.state.datasetName.trim();
    if (!datasetName) {
      this.setState({
        errorMsg: gettext('Name invalid.'),
      });
      return;
    }
    if (datasetName === this.props.dataset.dataset_name) {
      this.toggle();
      return;
    }
    this.props.submit(datasetName);
  };

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.submit();
    }
  };

  render() {
    let { datasetName, errorMsg } = this.state;
    return (
      <Modal isOpen={true} toggle={this.toggle} autoFocus={false}>
        <DTableModalHeader toggle={this.toggle}>
          {gettext('Rename dataset')}
        </DTableModalHeader>
        <ModalBody>
          <Input value={datasetName} onChange={this.onChangeDatasetName} onKeyDown={this.onKeyDown} autoFocus />
          {errorMsg && <Alert color='danger' className='mt-2'>{errorMsg}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button color='secondary' onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color='primary' onClick={this.submit} >{gettext('Submit')}</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

RenameDatasetDialog.propTypes = propTypes;

export default RenameDatasetDialog;
