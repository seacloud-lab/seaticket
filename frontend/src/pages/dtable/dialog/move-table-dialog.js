import React from 'react';
import PropTypes from 'prop-types';
import { DTableSelect } from 'dtable-ui-component';
import { gettext } from '../../../constants/config';
import { Modal, ModalBody, ModalFooter, Button, Label } from 'reactstrap';
import { DTableModalHeader } from 'dtable-ui-component';

const propTypes = {
  folders: PropTypes.array,
  toBeMovedItem: PropTypes.object,
  moveFolderItem: PropTypes.func,
  onMoveFolderItemToggle: PropTypes.func,
};


class MoveTableDialog extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dstFolder: null,
      validFolders: [],
    };
  }

  componentDidMount() {
    let { folders, toBeMovedItem } = this.props;
    let validFolders;
    if (toBeMovedItem.folder_id !== '/') {
      validFolders = [{
        label: '/',
        value: '/'
      }];
      folders.forEach(folder => {
        if (toBeMovedItem.folder_id !== folder.id) {
          validFolders.push({
            label: folder.name,
            value: folder.id
          });
        }
      });
    } else {
      validFolders = folders.map(folder => {
        return { label: folder.name, value: folder.id };
      });
    }
    this.setState({ validFolders: validFolders });
  }

  setFolder = (e) => {
    this.setState({ dstFolder: e.value });
  };

  handleSubmit = () => {
    let { toBeMovedItem } = this.props;
    let { dstFolder } = this.state;
    this.props.moveFolderItem(toBeMovedItem.folder_id, dstFolder);
    this.props.onMoveFolderItemToggle();
  };

  toggle = () => {
    this.props.onMoveFolderItemToggle();
  };

  render() {
    let { toBeMovedItem } = this.props;
    const tableName = toBeMovedItem.table.name;
    return (
      <Modal isOpen={true} toggle={this.toggle} size="md">
        <DTableModalHeader toggle={this.toggle}>
          <span className="mr-1">{gettext('Move')}
            <span className="op-target ml-1" title={tableName}>{tableName}</span>
          </span>
        </DTableModalHeader>
        <ModalBody >
          <Label for="copy-to-group">{gettext('Move to')}</Label>
          <DTableSelect
            options={this.state.validFolders}
            value={this.state.validFolders.find(folder => folder.value === this.state.dstFolder)}
            placeholder={<span>{gettext('Select a folder')}</span>}
            noOptionsMessage={() => {return <span>{gettext('No options avaliable')}</span>;}}
            onChange={this.setFolder}
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

MoveTableDialog.propTypes = propTypes;

export default MoveTableDialog;
