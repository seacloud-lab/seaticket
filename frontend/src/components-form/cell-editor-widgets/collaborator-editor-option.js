import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  column: PropTypes.object,
  collaborator: PropTypes.object,
  onDeleteCollaborator: PropTypes.func.isRequired,
  isReadOnly: PropTypes.bool
};

class CollaboratorEditorOption extends React.Component {

  static defaultProps = {
    isReadOnly: false
  };

  onDeleteCollaborator = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    let collaborator = this.props.collaborator;
    this.props.onDeleteCollaborator(collaborator);
  };

  getCollaborator = () => {
    let { collaborator } = this.props;
    return collaborator;
  };

  getContainerStyle = () => {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      marginRight: '10px',
      padding: '0 8px 0 2px',
      height: '20px',
      fontSize: '13px',
      borderRadius: '10px',
      background: '#eaeaea',
    };
  };

  getAvatarStyle = () => {
    return {
      display: 'flex',
      alignItems: 'center',
      margin: '0 4px 0 2px',
    };
  };

  getAvatarIconStyle = () => {
    return {
      width: '16px',
      height: '16px',
      marginRight: '4px',
      borderRadius: '50%',
    };
  };

  getOperationStyle = () => {
    return {
      display: 'inline-block',
      width: '16px',
      height: '20px',
      lineHeight: '20px',
      marginLeft: '4px',
      cursor: 'pointer',
      color: '#909090',
      transform: 'scale(.8)',
      textAlign: 'center'
    };
  };

  render() {
    let collaborator = this.getCollaborator();
    let containerStyle = this.getContainerStyle();
    let avatarStyle = this.getAvatarStyle();
    let avatarIconStyle = this.getAvatarIconStyle();
    let operationStyle = this.getOperationStyle();

    return (
      <div className="collaborator-option-item" style={containerStyle}>
        <span className="collaborator-avatar" style={avatarStyle}>
          <img className="collaborator-icon" style={avatarIconStyle} alt={collaborator.name} src={collaborator.avatar_url} />
        </span>
        <span className="collaborator-name text-truncate">{collaborator.name}</span>
        {!this.props.isReadOnly && (
          <span className="collaborator-remove" style={operationStyle} onClick={this.onDeleteCollaborator}>
            <i className="dtable-font dtable-icon-fork-number" style={{ fontSize: '12px', height: '20px', lineHeight: '20px' }}></i>
          </span>
        )}
      </div>
    );
  }
}

CollaboratorEditorOption.propTypes = propTypes;

export default CollaboratorEditorOption;
