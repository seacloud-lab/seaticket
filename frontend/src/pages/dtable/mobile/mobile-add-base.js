import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import AddBlankTable from './add-blank-table';
import AddBlankFolder from './add-blank-folder';
import ModalPortal from '../../../components/modal-portal';

const gettext = window.gettext;

const propTypes = {
  createProject: PropTypes.func,
  createBlankFolder: PropTypes.func,
  currentWorkspace: PropTypes.object,
  folder: PropTypes.object,
};

class MobileAddBase extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCreateProject: false,
      isShowCreateFolder: false,
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

  onCreateProjectToggle = () => {
    this.setState({ dropdownOpen: !this.state.dropdownOpen, isShowCreateProject: !this.state.isShowCreateProject });
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

  render() {
    const { currentWorkspace } = this.props;
    const { isShowCreateProject, isShowCreateFolder } = this.state;
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
                <span>{isFolder ? gettext('Add a project') : gettext('Add a project or folder')}</span>
              </div>
              <div className="table-mobile-dropdown-menu"></div>
            </DropdownToggle>
            <div className={this.state.dropdownOpen ? '' : 'd-none'} onClick={this.dropdownToggle}>
              <div className="mobile-operation-menu-bg-layer"></div>
              <div className="mobile-operation-menu">
                <DropdownItem onClick={this.onCreateProjectToggle} className="mobile-dropdown-item" >
                  <span className="item-icon dtable-font dtable-icon-add-table"></span>
                  <span className="mobile-dropdown-span">{gettext('Create a blank project')}</span>
                </DropdownItem>
                {!isFolder &&
                  <DropdownItem onClick={this.onCreateFolderToggle} className="mobile-dropdown-item">
                    <span className="item-icon dtable-font dtable-icon-folders"></span>
                    <span className="mobile-dropdown-span">{gettext('Create a folder')}</span>
                  </DropdownItem>
                }
              </div>
            </div>
          </Dropdown>
        </div>
        {isShowCreateProject &&
          <ModalPortal>
            <AddBlankTable
              onCreateProjectToggle={this.onCreateProjectToggle}
              createProject={this.props.createProject}
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
      </Fragment>
    );
  }
}

MobileAddBase.propTypes = propTypes;

export default MobileAddBase;
