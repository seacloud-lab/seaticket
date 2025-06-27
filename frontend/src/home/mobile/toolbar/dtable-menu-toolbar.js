import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import CreateGroupDialog from '../../dialog/create-group-dialog';

const propTypes = {
  onShowSidePanel: PropTypes.func.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
};

class DtableMenuToolbar extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isShowCreateGroupDialog: false
    };
  }

  onCreateToggle = () => {
    this.setState({
      isShowCreateGroupDialog: !this.state.isShowCreateGroupDialog
    });
  };

  onCreateGroup = () => {
    this.props.loadWorkspaceList();
    this.onCreateToggle();
  };

  render() {
    return (
      <Fragment>
        <div className="dtable-menu-toolbar">
          <span className="dtable-font dtable-icon-menu side-nav-toggle mobile-toolbar-icon" onClick={this.props.onShowSidePanel}></span>
        </div>
        {this.state.isShowCreateGroupDialog && (
          <CreateGroupDialog
            onSubmit={this.onCreateGroup}
            onToggle={this.onCreateToggle}
          />
        )}
      </Fragment>
    );
  }
}

DtableMenuToolbar.propTypes = propTypes;

export default DtableMenuToolbar;
