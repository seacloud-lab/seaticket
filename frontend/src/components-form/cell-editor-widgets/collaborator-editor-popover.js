import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';

const propTypes = {
  popoverStyle: PropTypes.object.isRequired,
  collaborators: PropTypes.array.isRequired,
  selectedCollaborators: PropTypes.array.isRequired,
  onOptionItemToggle: PropTypes.func.isRequired,
};

class CollaboratorEditorPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
    };
  }

  onValueChanged = (e) => {
    let value = e.target.value.trim();
    this.setState({ searchValue: value });
  };

  onInputClick = (event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  };

  onOptionItemToggle = (collaborator) => {
    this.props.onOptionItemToggle(collaborator);
  };

  getFilterCollaborators = () => {
    let { collaborators } = this.props;
    let filter = this.state.searchValue.toLowerCase();
    if (!filter) {
      return collaborators;
    }
    return collaborators.filter(collaborator => {
      return (collaborator.name.toString().toLowerCase()).indexOf(filter) > -1;
    });
  };

  render() {

    let { popoverStyle, selectedCollaborators } = this.props;
    let collaborators = this.getFilterCollaborators();

    return (
      <div className="collaborator-editor-popover" style={popoverStyle}>
        <div className="collaborator-options-search">
          <input className="form-control" onChange={this.onValueChanged} onClick={this.onInputClick} placeholder={gettext('Search collaborator')}></input>
        </div>
        <div className="collaborator-options-container">
          {collaborators.length > 0 && collaborators.map((collaborator, index) => {
            // check is selected
            let isSelect = selectedCollaborators.some(selectedCollaborator => {
              return selectedCollaborator.email === collaborator.email;
            });
            return (
              <div key={index} className="collaborator-option-item" onClick={this.onOptionItemToggle.bind(this, collaborator)}>
                <div className="collaborator-avatar">
                  <img className="collaborator-icon" alt={collaborator.name} src={collaborator.avatar_url} />
                  <span className="collaborator-name text-truncate">{collaborator.name}</span>
                </div>
                <div className="collaborator-checked">
                  {isSelect && <i className="dtable-font dtable-icon-check-mark" style={{ fontSize: '12px' }}></i>}
                </div>
              </div>
            );
          })}
          {collaborators.length === 0 && (<div className="search-option-null">{gettext('No collaborators available')}</div>)}
        </div>
      </div>
    );
  }
}

CollaboratorEditorPopover.propTypes = propTypes;

export default CollaboratorEditorPopover;
