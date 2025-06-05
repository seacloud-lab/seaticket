import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import isHotkey from 'is-hotkey';
import { toaster } from 'dtable-ui-component';

const gettext = window.gettext;

const propTypes = {
  currentName: PropTypes.string,
  onUpdateCurrentName: PropTypes.func.isRequired,
};

class Rename extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      isRenaming: false,
      name: props.currentName,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.currentName !== this.props.currentName) {
      this.setState({ name: nextProps.currentName });
    }
  }

  onRenameClick = () => {
    this.setState({ isRenaming: true }, () => {
      this.input.focus();
    });
  };

  onChange = (event) => {
    const { value } = event.target;
    this.setState({ name: value });
  };

  onKeyDown = (event) => {
    let { selectionStart, selectionEnd, value } = event.currentTarget;
    if (isHotkey('enter', event)) {
      event.preventDefault();
      this.input.blur();
    } else if ((event.keyCode === 37 && selectionStart === 0) ||
      (event.keyCode === 39 && selectionEnd === value.length)
    ) {
      event.stopPropagation();
    }
  };

  onBlur = () => {
    this.setState({ isRenaming: false });
    let newName = this.state.name.trim();
    if (newName) {
      this.props.onUpdateCurrentName(newName);
    } else {
      // if name is vacant, set name to original name
      this.setState({ name: this.props.currentName });
      toaster.danger(gettext('Name is required'));
    }
  };

  setInputRef = (ref) => {
    this.input = ref;
  };

  render() {
    const { isRenaming, name } = this.state;
    return (
      <div className="dtable-edit-collection-table-rename">
        {isRenaming ?
          <input
            ref={this.setInputRef}
            type="text"
            className="form-control"
            value={name}
            onKeyDown={this.onKeyDown}
            onBlur={this.onBlur}
            onChange={this.onChange}
          />
          :
          <Fragment>
            <span className="mr-2">{name}</span>
            <i className="dtable-font dtable-icon-rename edit" onClick={this.onRenameClick}></i>
          </Fragment>
        }
      </div>
    );
  }
}

Rename.propTypes = propTypes;

export default Rename;
