import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody, ModalFooter, Button, Input } from 'reactstrap';
import { gettext } from '../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  orgName: PropTypes.string.isRequired,
  executeOperation: PropTypes.func.isRequired,
  toggleDialog: PropTypes.func.isRequired
};

class ConfirmDeleteOrg extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmText: '',
    };
    this.newInput = React.createRef();
  }

  onKeyDown = (e) => {
    if (e.key === 'Enter') {
      this.createTag();
    }
  };

  inputConfirmText = (e) => {
    this.setState({
      confirmText: e.target.value,
    });
  };

  toggle = () => {
    this.props.toggleDialog();
  };

  executeOperation = () => {
    this.toggle();
    this.props.executeOperation();
  };

  render() {
    let { title, message, orgName } = this.props;
    let canDelete = this.state.confirmText === orgName ? true : false;
    return (
      <Modal isOpen={true} toggle={this.toggle}>
        <DTableModalHeader toggle={this.toggle}>{title}</DTableModalHeader>
        <ModalBody>
          <p dangerouslySetInnerHTML={{ __html: message }}></p>
          <div className="form-group">
            <Input
              onKeyDown={this.onKeyDown}
              innerRef={input => {this.newInput = input;}}
              value={this.state.confirmText}
              onChange={this.inputConfirmText}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          {canDelete ?
            <Button color="primary" onClick={this.executeOperation}>{gettext('Delete')}</Button> :
            <Button color="primary" disabled>{gettext('Delete')}</Button>
          }
        </ModalFooter>
      </Modal>
    );
  }
}

ConfirmDeleteOrg.propTypes = propTypes;

export default ConfirmDeleteOrg;
