import React from 'react';
import PropTypes from 'prop-types';
import CollaboratorEditorOption from '../cell-editor-widgets/collaborator-editor-option';
import CollaboratorEditorPopover from '../cell-editor-widgets/collaborator-editor-popover';
import { dtableWebAPI } from '../../api/dtable-web-api';
import User from '../../pages/dtable/model/user';

import '../cell-css/collaborator.css';

const propTypes = {
  isReadOnly: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  column: PropTypes.object,
  onCommit: PropTypes.func,
};

const POPOVER_MAX_HEIGHT = 200;

class CollaboratorEditor extends React.Component {

  static defaultProps = {
    isReadOnly: false,
    value: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      newValue: this.props.value,
      isDataInit: false,
      isPopoverShow: false,
      collaborators: [],
    };
  }

  componentDidMount() {
    this.setState({
      isDataInit: true,
    });
    this.getCollaborators();
    document.addEventListener('click', this.onDocumentToggle);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.onDocumentToggle);
  }

  getCollaborators = () => {
    if (window.app && window.app.collaborators) {
      this.setState({ collaborators: window.app.collaborators });
    } else {
      const { workspaceID, dtableName } = window.shared.pageOptions;
      dtableWebAPI.getTableRelatedUsers(workspaceID, dtableName).then(res => {
        let collaborators = (res.data ? res.data.user_list : []).map(item => {
          return new User(item);
        });
        this.setState({ collaborators });
        this.addCache(collaborators);
      });
    }
  };

  addCache = (collaborators) => {
    if (!window.app) {
      window.app = {};
    }
    window.app.collaborators = collaborators;
  };

  formatCollaborators = () => {
    let { newValue, collaborators } = this.state;
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

  onDocumentToggle = (e) => {
    if (e.target && e.target.className.includes('collaborator')) return;
    this.setState({ isPopoverShow: false });
  };

  onAddCollaboratorToggle = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
    if (this.props.isReadOnly || this.props.isSubmitting) {
      return;
    }
    this.setState({ isPopoverShow: !this.state.isPopoverShow });
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

  caculatePopoverPosition = () => {
    let innerHeight = window.innerHeight;
    let { top, left, height } = this.editor.getClientRects()[0];
    let isBelow = (innerHeight - (top + height)) > POPOVER_MAX_HEIGHT;
    let position = { top: (top + height + 1), left: left };
    if (!isBelow) {
      let bottom = innerHeight - top;
      position = { bottom: bottom, left: left };
    }
    return position;
  };

  getPopoverStyle = () => {
    if (!this.state.isDataInit) {
      return null;
    }
    let defaultPosition = {
      position: 'absolute',
    };
    let position = this.caculatePopoverPosition();
    return Object.assign({}, { ...defaultPosition }, { ...position });
  };

  render() {
    let { collaborators } = this.state;
    let { isReadOnly } = this.props;
    let selectedCollaborators = this.formatCollaborators();
    let popoverStyle = this.getPopoverStyle();
    return (
      <div className="cell-editor grid-cell-type-collaborator">
        <div ref={this.setEditorRef} className="collaborator-editor-container" >
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
        {!isReadOnly && (
          <div className="collaborator-editor-add" onClick={this.onAddCollaboratorToggle}>
            <i className="dtable-font dtable-icon-add-square"></i>
          </div>
        )}
        {this.state.isPopoverShow && (
          <CollaboratorEditorPopover
            popoverStyle={popoverStyle}
            collaborators={collaborators}
            selectedCollaborators={selectedCollaborators}
            onOptionItemToggle={this.onOptionItemToggle}
          />
        )}
      </div>
    );
  }
}

CollaboratorEditor.propTypes = propTypes;

export default CollaboratorEditor;
