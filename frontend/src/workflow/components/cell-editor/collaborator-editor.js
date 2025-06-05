import React from 'react';
import PropTypes from 'prop-types';
import CollaboratorEditorOption from '../../../components-form/cell-editor-widgets/collaborator-editor-option';
import CollaboratorEditorPopover from './widgets/collaborator-editor/collaborator-editor-popover';
import ValueEmpty from '../../components/common/value-empty';
import ParticipantsEditor from './participants-editor';

import '../../css/cell-editor/collaborator.css';

class CollaboratorEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: props.value || [],
      isPopoverShow: false,
    };
  }

  componentDidMount() {
    if (this.props.queryUsers) {
      this.props.queryUsers(this.state.newValue);
    }
  }

  formatCollaborators = () => {
    let { collaborators } = this.props;
    let { newValue } = this.state;
    if (!newValue || newValue.length === 0) {
      return [];
    }
    let selectedCollaborators = collaborators.length > 0 && collaborators.filter(collaborator => {
      return newValue && newValue.indexOf(collaborator.email) > -1;
    });
    return selectedCollaborators || [];
  };

  onCommit = (newValue) => {
    let updated = {};
    let { column } = this.props;
    updated[column.key] = newValue;
    this.props.onCommit(updated, column);
  };

  onAddCollaboratorToggle = () => {
    if (this.props.isReadOnly || this.props.isSubmitting) return;
    this.setState({ isPopoverShow: !this.state.isPopoverShow }, () => {
      this.props.updateTabIndex && this.props.updateTabIndex();
    });
  };

  onDeleteCollaborator = (collaborator) => {
    let { newValue: currentValue } = this.state;
    let newValue = currentValue.filter(item => item !== collaborator.email);
    this.setState({ newValue: newValue }, () => {
      this.onCommit(newValue);
    });
  };

  onOptionItemToggle = (collaborator) => {
    let { newValue: currentValue } = this.state;
    let newValue = (currentValue && currentValue.length > 0) ? currentValue.slice(0) : []; // make a copy
    let email_index = newValue.indexOf(collaborator.email);
    if (email_index > -1) {
      newValue.splice(email_index, 1);
    } else {
      newValue.push(collaborator.email);
    }
    this.setState({ newValue: newValue }, () => {
      this.onCommit(newValue);
    });
  };

  setEditorRef = (editor) => {
    this.editor = editor;
  };

  renderAddContent = (selectedCollaborators) => {
    const { isReadOnly } = this.props;
    if (!isReadOnly) {
      return (
        <div className="collaborator-editor-add" onClick={this.onAddCollaboratorToggle}>
          <i className="dtable-font dtable-icon-add-square"></i>
        </div>
      );
    }
    if (Array.isArray(selectedCollaborators) && selectedCollaborators.length > 0) return null;
    return <ValueEmpty />;
  };

  render() {
    const { isReadOnly, column, collaborators } = this.props;
    if (column.is_dynamic_participants_column) {
      return <ParticipantsEditor {...this.props} />;
    }
    const selectedCollaborators = this.formatCollaborators();
    const target = `grid-cell-type-collaborator-${column.key}`;

    return (
      <div className="cell-editor grid-cell-type-collaborator" id={target}>
        <div ref={this.setEditorRef} className={`collaborator-editor-container ${isReadOnly ? 'readOnly' : ''}`}>
          {selectedCollaborators.map((collaborator, index) => {
            return (
              <CollaboratorEditorOption
                key={index}
                collaborator={collaborator}
                onDeleteCollaborator={this.onDeleteCollaborator}
                isReadOnly={isReadOnly}
              />
            );
          })}
        </div>
        {this.renderAddContent(selectedCollaborators)}
        {this.state.isPopoverShow && (
          <CollaboratorEditorPopover
            target={target}
            collaborators={collaborators}
            selectedCollaborators={selectedCollaborators}
            onOptionItemToggle={this.onOptionItemToggle}
            onCollaboratorPopoverToggle={this.onAddCollaboratorToggle}
          />
        )}
      </div>
    );
  }
}

CollaboratorEditor.propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
  editorConfig: PropTypes.object,
  onCommit: PropTypes.func,
  updateTabIndex: PropTypes.func,
  queryUsers: PropTypes.func,
  collaborators: PropTypes.array,
};

export default CollaboratorEditor;
