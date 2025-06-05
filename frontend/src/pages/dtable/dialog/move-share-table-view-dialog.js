import React from 'react';
import PropTypes from 'prop-types';
import { DTableSelect } from 'dtable-ui-component';
import { Modal, ModalBody, ModalFooter, Button, Label } from 'reactstrap';
import { gettext } from '../../../utils/constants';
import { DTableModalHeader } from 'dtable-ui-component';

export default class MoveShareTableViewDialog extends React.Component {

  static propTypes = {
    currentFolder: PropTypes.object,
    folders: PropTypes.array,
    toBeMovedItem: PropTypes.object,
    moveFolderItem: PropTypes.func,
    onMoveFolderItemToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      dstFolder: null,
      validFolders: this.getFolders(),
    };
  }

  getFolders = () => {
    const { currentFolder, folders } = this.props;
    const currentFolderId = currentFolder ? currentFolder.id : null;
    let validFolders = folders.filter(folder => currentFolderId !== folder.id).map(folder => {
      return {
        label: folder.name,
        value: folder.name,
      };
    });
    if (currentFolder) {
      validFolders.unshift({ label: '/', value: '/' });
    }
    return validFolders;
  };

  onChange = (e) => {
    this.setState({ dstFolder: e.value });
  };

  handleSubmit = () => {
    this.props.moveFolderItem(this.props.toBeMovedItem, this.state.dstFolder);
    this.props.onMoveFolderItemToggle();
  };

  toggle = () => {
    this.props.onMoveFolderItemToggle();
  };

  render() {
    let { toBeMovedItem } = this.props;
    return (
      <Modal isOpen={true} toggle={this.toggle} size="md">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Move')}
            <span className="op-target ml-1" title={toBeMovedItem.name}>{toBeMovedItem.name}</span>
          </span>
        </DTableModalHeader>
        <ModalBody >
          <Label for="copy-to-group">{gettext('Move to')}</Label>
          <DTableSelect
            options={this.state.validFolders}
            value={this.state.validFolders.find(folder => folder.value === this.state.dstFolder)}
            placeholder={<span>{gettext('Select a folder')}</span>}
            noOptionsMessage={() => {return <span>{gettext('No options avaliable')}</span>;}}
            onChange={this.onChange}
            menuPortalTarget={null}
            menuPosition="absolute"
          />
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.toggle}>{gettext('Cancel')}</Button>
          <Button color="primary" onClick={this.handleSubmit} disabled={!this.state.dstFolder}>
            {gettext('Submit')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }
}
