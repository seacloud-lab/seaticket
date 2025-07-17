import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import CreateGroupDialog from '../../dialog/create-group-dialog';
import { IconButton } from '../../../components';

const propTypes = {
  onShowSidePanel: PropTypes.func.isRequired,
  loadWorkspaceList: PropTypes.func.isRequired,
};

class ProjectMenuToolbar extends React.Component {

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
        <IconButton icon="menu" className="side-nav-toggle mobile-toolbar-icon" onClick={this.props.onShowSidePanel} />
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

ProjectMenuToolbar.propTypes = propTypes;

export default ProjectMenuToolbar;
