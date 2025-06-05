import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { enableCreateBaseFromTemplate } from '../../../utils/constants';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onShowTemplateListToggle: PropTypes.func.isRequired,
  uploadDTableFile: PropTypes.func.isRequired,
  onCreateTableToggle: PropTypes.func.isRequired,
  onCreateFolderToggle: PropTypes.func,
  folder: PropTypes.object,
};
class AddBaseDropdownMenu extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isTableRenaming: false,
      dropdownOpen: false,
      active: false,
    };
  }

  dropdownToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  onShowTemplateListToggle = () => {
    this.props.onShowTemplateListToggle();
  };

  onCreateTableToggle = () => {
    this.props.onCreateTableToggle(this.props.folder);
  };

  openUploadInput = (e) => {
    e.stopPropagation();
    this.uploadInput.click();
  };

  uploadDTableFile = () => {
    // no file selected
    if (!this.uploadInput.files.length) {
      return;
    }
    const file = this.uploadInput.files[0];
    this.props.uploadDTableFile(this.props.currentWorkspace.id, file);
    this.dropdownToggle();
  };

  onUploadClick = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  };

  onCreateFolderToggle = () => {
    this.props.onCreateFolderToggle && this.props.onCreateFolderToggle();
  };

  render() {
    const isFolder = !!this.props.folder;
    return (
      <Dropdown
        isOpen={this.state.dropdownOpen}
        toggle={this.dropdownToggle}
        direction="down"
        className="add-base-dropdown-menu"
        aria-label={gettext('More operations')}
      >
        <DropdownToggle
          tag='i'
          role="button"
          className='dropdown-menu-toggle'
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          data-toggle="dropdown"
          aria-expanded={this.state.dropdownOpen}
          aria-haspopup={true}
          direction="down"
          tabIndex={0}
        >
          <div className="table-icon" aria-hidden="true">
            <span className="table-icon-content">
              <i className="base-font icon-add dtable-icon-style"></i>
            </span>
          </div>
          <div className="table-name">
            <span className="a-simulate">{isFolder ? gettext('Add a base') : gettext('Add a base or folder')}</span>
          </div>
          <div className="table-dropdown-menu"></div>
        </DropdownToggle>
        <DropdownMenu className="dtable-dropdown-menu dropdown-menu dropdown-menu-list large">
          <DropdownItem onClick={this.onCreateTableToggle} >
            <span className="item-icon dtable-font dtable-icon-add-table" aria-hidden="true"></span>
            <span aria-label={gettext('Create a blank base')}>{gettext('Create a blank base')}</span>
          </DropdownItem>
          <DropdownItem onClick={this.openUploadInput} toggle={false}>
            <span className="item-icon dtable-font dtable-icon-import" aria-hidden="true"></span>
            <span aria-label={gettext('Import from file (*.xlsx *.csv *.dtable)')}>{gettext('Import from file (*.xlsx *.csv *.dtable)')}</span>
            <input
              className="d-none"
              type="file"
              accept=".dtable, .csv, .xlsx"
              ref={ref => this.uploadInput = ref}
              onChange={this.uploadDTableFile}
              onClick={this.onUploadClick}
              aria-label={gettext('Import from file')}
            />
          </DropdownItem>
          {enableCreateBaseFromTemplate &&
            <DropdownItem onClick={this.onShowTemplateListToggle}>
              <span className="item-icon dtable-font dtable-icon-templates" aria-hidden="true"></span>
              <span aria-label={gettext('Create from a template')}>{gettext('Create from a template')}</span>
            </DropdownItem>
          }
          {!this.props.folder &&
            <DropdownItem onClick={this.onCreateFolderToggle} >
              <span className="item-icon dtable-font dtable-icon-folders" aria-hidden="true"></span>
              <span aria-label={gettext('Create a folder')}>{gettext('Create a folder')}</span>
            </DropdownItem>
          }
        </DropdownMenu>
      </Dropdown>
    );
  }
}

AddBaseDropdownMenu.propTypes = propTypes;

export default AddBaseDropdownMenu;
