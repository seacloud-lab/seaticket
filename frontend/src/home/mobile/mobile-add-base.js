import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, DropdownToggle, DropdownItem } from 'reactstrap';
import AddBlankTable from './add-blank-table';
import ModalPortal from '../../components/modal-portal';

const gettext = window.gettext;

const propTypes = {
  createProject: PropTypes.func,
  currentWorkspace: PropTypes.object,
};

class MobileAddBase extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCreateProject: false,
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
    const { isShowCreateProject } = this.state;
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
                  <i className="project-icon icon-add project-icon-style"></i>
                </span>
              </div>
              <div className="table-mobile-name">
                <span>{gettext('Add a project')}</span>
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
      </Fragment>
    );
  }
}

MobileAddBase.propTypes = propTypes;

export default MobileAddBase;
