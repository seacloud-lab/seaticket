import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import { enableCreateBaseFromTemplate } from '../../../utils/constants';
import AddBlankTable from './add-blank-table';
import AddBlankFolder from './add-blank-folder';
import ModalPortal from '../../../components/modal-portal';
import MobileTemplateList from './mobile-template-list';

const gettext = window.gettext;

const propTypes = {
  isCreatedTemplateLoading: PropTypes.bool,
  createDTable: PropTypes.func,
  createBlankFolder: PropTypes.func,
  currentWorkspace: PropTypes.object,
  addDtableFromExternalLink: PropTypes.func,
  uploadDTableFile: PropTypes.func.isRequired,
  folder: PropTypes.object,
};

class MobileAddBase extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCreateTable: false,
      isShowCreateFolder: false,
      isShowTemplateList: false,
      dropdownOpen: false,
      isWeChat: this.isWeChat(),
    };
  }

  dropdownToggle = (e) => {
    if (e.target.closest('.mobile-dropdown-item')) {
      return;
    }
    this.setState({ dropdownOpen: !this.state.dropdownOpen });
  };

  // Check whether it is WeChat
  isWeChat = () => {
    const ua = window.navigator.userAgent.toLowerCase();
    if (ua.match(/MicroMessenger/i) === 'micromessenger') {
      return true;
    }
    return false;
  };

  onShowTemplateListToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen, isShowTemplateList: !this.state.isShowTemplateList });
  };

  onCreateTableToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen, isShowCreateTable: !this.state.isShowCreateTable });
  };

  onCreateFolderToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen, isShowCreateFolder: !this.state.isShowCreateFolder });
  };

  onOpenUploadInput = (e) => {
    e.stopPropagation();
    this.uploadInput.click();
  };

  onUploadClick = (event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  };

  uploadDTableFile = () => {
    // no file selected
    if (!this.uploadInput.files.length) {
      return;
    }
    const file = this.uploadInput.files[0];
    this.props.uploadDTableFile(this.props.currentWorkspace.id, file);
  };

  render() {
    const { currentWorkspace } = this.props;
    const { isShowCreateTable, isShowTemplateList, isShowCreateFolder, isWeChat } = this.state;
    const isFolder = !!this.props.folder;
    return (
      <Fragment>
        <div className="table-mobile-item">
          <Dropdown isOpen={this.state.dropdownOpen} toggle={this.dropdownToggle} direction="down" className="add-base-dropdown-menu">
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
            >
              <div className="table-mobile-icon" aria-hidden="true">
                <span className="table-icon-content">
                  <i className="base-font icon-add dtable-icon-style"></i>
                </span>
              </div>
              <div className="table-mobile-name">
                <span>{isFolder ? gettext('Add a base') : gettext('Add a base or folder')}</span>
              </div>
              <div className="table-mobile-dropdown-menu"></div>
            </DropdownToggle>
            <div className={this.state.dropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
              <div className="mobile-operation-menu-bg-layer"></div>
              <div className="mobile-operation-menu">
                <DropdownItem onClick={this.onCreateTableToggle} className="mobile-dropdown-item" >
                  <span className="item-icon dtable-font dtable-icon-add-table"></span>
                  <span className="mobile-dropdown-span">{gettext('Create a blank base')}</span>
                </DropdownItem>
                {enableCreateBaseFromTemplate &&
                  <DropdownItem onClick={this.onShowTemplateListToggle} className="mobile-dropdown-item">
                    <span className="item-icon dtable-font dtable-icon-templates"></span>
                    <span className="mobile-dropdown-span">{gettext('Create from a template')}</span>
                  </DropdownItem>
                }
                {!isFolder &&
                  <DropdownItem onClick={this.onCreateFolderToggle} className="mobile-dropdown-item">
                    <span className="item-icon dtable-font dtable-icon-folders"></span>
                    <span className="mobile-dropdown-span">{gettext('Create a folder')}</span>
                  </DropdownItem>
                }
                {!isWeChat &&
                  <DropdownItem onClick={this.onOpenUploadInput} className="mobile-dropdown-item" >
                    <span className="item-icon dtable-font dtable-icon-import"></span>
                    <span className="mobile-dropdown-span">{gettext('Import from file (*.xlsx *.csv *.dtable)')}</span>
                    <input className="d-none" type="file" accept=".dtable, .csv, .xlsx" ref={ref => this.uploadInput = ref} onChange={this.uploadDTableFile} onClick={this.onUploadClick}/>
                  </DropdownItem>
                }
              </div>
            </div>
          </Dropdown>
        </div>
        {isShowCreateTable &&
          <ModalPortal>
            <AddBlankTable
              onCreateTableToggle={this.onCreateTableToggle}
              createDTable={this.props.createDTable}
              currentWorkspace={currentWorkspace}
            />
          </ModalPortal>
        }
        {isShowCreateFolder &&
          <ModalPortal>
            <AddBlankFolder
              onCreateFolderToggle={this.onCreateFolderToggle}
              createBlankFolder={this.props.createBlankFolder}
              currentWorkspace={this.props.currentWorkspace}
            />
          </ModalPortal>
        }
        {isShowTemplateList &&
          <ModalPortal>
            <MobileTemplateList
              isSinglePage={true}
              onShowTemplateListToggle={this.onShowTemplateListToggle}
              addDtableFromExternalLink={this.props.addDtableFromExternalLink}
              isCreatedTemplateLoading={this.props.isCreatedTemplateLoading}
            />
          </ModalPortal>
        }
      </Fragment>
    );
  }
}

MobileAddBase.propTypes = propTypes;

export default MobileAddBase;
