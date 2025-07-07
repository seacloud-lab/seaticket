import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Account from '../../components/account';
import { Utils } from '../../utils/utils';

const propTypes = {
  children: PropTypes.node,
  search: PropTypes.element,
  onCloseSidePanel: PropTypes.func,
};

class MainPanelTopbar extends Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowOperationMenu: false
    };
  }

  onShowOperationToggle = () => {
    this.setState({ isShowOperationMenu: !this.state.isShowOperationMenu });
  };

  onCloseSidePanel = () => {
    if (this.props.onCloseSidePanel) {
      this.props.onCloseSidePanel();
    }
  };

  render() {
    const { children } = this.props;
    const isDesktop = Utils.isDesktop();
    if (isDesktop) {
      return (
        <div className={`main-panel-north ${children ? 'border-left-show' : ''}`}>
          <div className="cur-view-toolbar">
            <span className="sf2-icon-menu side-nav-toggle hidden-md-up d-md-none" title="Side Nav Menu" aria-label="Side Nav Menu"></span>
            <div className="operation">
              {this.props.children}
            </div>
          </div>
          <div className="common-toolbar">
            {this.props.search && this.props.search}
            <Account isAdminPanel={true}/>
          </div>
        </div>
      );
    }
    return (
      <div className={`main-panel-north ${children ? 'border-left-show' : ''}`}>
        <div className="cur-view-toolbar">
          <div className={this.state.isShowOperationMenu ? '' : 'd-none'} onClick={this.onShowOperationToggle}>
            <div className="mobile-operation-menu-bg-layer"></div>
            <div className="mobile-operation-menu">
              {this.state.isShowOperationMenu && children}
            </div>
          </div>
          <span className="dtable-font dtable-icon-menu side-nav-toggle mobile-toolbar-icon" onClick={this.onCloseSidePanel}></span>
          {children &&
            <span className="dtable-font dtable-icon-add-table mobile-toolbar-icon" onClick={this.onShowOperationToggle}></span>
          }
        </div>
        <div className="common-toolbar" style={{ alignItems: 'center' }}>
          {this.props.search && this.props.search}
          <Account isAdminPanel={true} />
        </div>
      </div>
    );
  }
}

MainPanelTopbar.propTypes = propTypes;

export default MainPanelTopbar;
