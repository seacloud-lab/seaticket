import React from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem, Button } from 'reactstrap';
import { enableCreateBaseFromTemplate } from '../../../utils/constants';

const gettext = window.gettext;

const propTypes = {
  currentWorkspace: PropTypes.object.isRequired,
  onShowTemplateListToggle: PropTypes.func.isRequired,
  uploadDTableFile: PropTypes.func.isRequired,
  onCreateTableToggle: PropTypes.func.isRequired,
  folder: PropTypes.object,
};

class AddDropdownBtn extends React.Component {

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

  render() {
    return (
      <Dropdown
        isOpen={this.state.dropdownOpen}
        toggle={this.dropdownToggle}
        direction="left"
        className="add-base-dropdown-menu"
        aria-label={gettext('More operations')}
      >
        <DropdownToggle
          tag='i'
          role="button"
          className='dropdown-menu-toggle'
          data-toggle="dropdown"
          title={gettext('More operations')}
          aria-label={gettext('More operations')}
          aria-expanded={this.state.dropdownOpen}
          aria-haspopup={true}
          direction="down"
        >
          <Button color="primary" size="sm">
            <span className='dtable-font dtable-icon-enlarge mr-2' aria-hidden="true"></span>
            <span aria-label={gettext('Create a blank base')}>{gettext('New')}</span>
          </Button>
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
        </DropdownMenu>
      </Dropdown>
    );
  }
}

AddDropdownBtn.propTypes = propTypes;

export default AddDropdownBtn;
