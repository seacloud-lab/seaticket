import React from 'react';
import PropTypes from 'prop-types';
import { isEnter } from '../../../../utils/hotkey';

const gettext = window.gettext;

export default class WorkspaceName extends React.Component {

  static propTypes = {
    workspace: PropTypes.object,
    isOver: PropTypes.bool.isRequired,
    connectDropTarget: PropTypes.func.isRequired,
    changeCurrentFolder: PropTypes.func.isRequired,
  };

  componentDidMount() {
    document.addEventListener('keydown', this.onHotKey);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onHotKey);
  }

  onHotKey = (e) => {
    if (isEnter(e) && document.activeElement && document.activeElement.id === 'folder-tree-workspace-name') {
      this.props.changeCurrentFolder(null);
    }
  };

  render() {
    const { workspace, connectDropTarget, isOver } = this.props;
    // folder in share with me
    if (!workspace) {
      return connectDropTarget(
        <div
          className={`folder-tree-workspace-name mb-1 cursor-pointer ${isOver ? 'tr-highlight' : ''}`}
          onClick={() => {this.props.changeCurrentFolder(null);}}
          tabIndex={0}
          id='folder-tree-workspace-name'
        >
          <i className='dtable-font dtable-icon-share-with-me' aria-hidden="true"></i>
          <span title={gettext('Shared with me')} aria-label={gettext('Shared with me')}>{gettext('Shared with me')}</span>
        </div>
      );
    }
    // default folder
    const { type, name } = workspace;
    const title = type === 'personal' ? gettext('My projects') : name;
    return connectDropTarget(
      <div
        className={`folder-tree-workspace-name mb-1 cursor-pointer ${isOver ? 'tr-highlight' : ''}`}
        onClick={() => {this.props.changeCurrentFolder(null);}}
        tabIndex={0}
        id='folder-tree-workspace-name'
      >
        <i className={`dtable-font dtable-icon-${type === 'personal' ? 'creator' : 'collaborator'}`} aria-hidden="true"></i>
        <span title={title} aria-label={title}>{title}</span>
      </div>
    );
  }
}
