import React from 'react';
import PropTypes from 'prop-types';
import DTablePopover from '../../../../../components/dtable-popover';

const gettext = window.gettext;

class CollaboratorEditorPopover extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      searchValue: '',
    };
  }

  onValueChanged = (e) => {
    const value = e.target.value;
    this.setState({ searchValue: value });
  };

  onInputClick = (event) => {
    event && event.nativeEvent.stopImmediatePropagation();
    event && event.stopPropagation();
  };

  onOptionItemToggle = (collaborator) => {
    this.props.onOptionItemToggle(collaborator);
  };

  getFilterCollaborators = () => {
    const { collaborators } = this.props;
    const filter = this.state.searchValue.trim().toLowerCase();
    if (!filter) return collaborators;
    return collaborators.filter(collaborator => {
      return (collaborator.name.toString().toLowerCase()).indexOf(filter) > -1;
    });
  };

  render() {
    const { target, selectedCollaborators } = this.props;
    const collaborators = this.getFilterCollaborators();
    const popoverClassName = 'collaborator-editor-popover workflow-collaborator-editor-popover';

    return (
      <DTablePopover
        popoverClassName={popoverClassName}
        hideArrow={true}
        target={target}
        placement="bottom-start"
        hideDTablePopover={this.props.onCollaboratorPopoverToggle}
        hideDTablePopoverWithEsc={this.props.onCollaboratorPopoverToggle}
      >
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
      </DTablePopover>
    );
  }
}

CollaboratorEditorPopover.propTypes = {
  target: PropTypes.string.isRequired,
  searchTips: PropTypes.string,
  noMatchedTips: PropTypes.string,
  collaborators: PropTypes.array.isRequired,
  selectedCollaborators: PropTypes.array.isRequired,
  onOptionItemToggle: PropTypes.func.isRequired,
  onCollaboratorPopoverToggle: PropTypes.func.isRequired,
};

export default CollaboratorEditorPopover;
