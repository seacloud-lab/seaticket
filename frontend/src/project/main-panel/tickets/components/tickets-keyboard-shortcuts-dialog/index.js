import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader } from '@/components';

import './index.css';

const propTypes = {
  toggle: PropTypes.func.isRequired,
};

class KeyboardShortcuts extends React.PureComponent {

  renderShortcut = (keys) => {
    return (
      <Fragment>
        <span className="keyboard-shortcut">
          {keys.map((key, index) => {
            return <kbd key={index}>{key}</kbd>;
          })}
        </span><br/>
      </Fragment>
    );
  };

  renderContainer = (keys, description) => {
    return (
      <div className="keyboard-shortcut-container">
        <div className="col-3">{this.renderShortcut(keys)}</div>
        <div className="col-9">{description}</div>
      </div>
    );
  };

  render() {
    let { toggle } = this.props;
    return (
      <Modal isOpen={true} toggle={toggle} className="keyboard-shortcut-dialog">
        <ModalHeader toggle={toggle}>
          <span className="mr-2">{gettext('Keyboard shortcuts')}</span>
          <span className="keyboard-shortcut">
            <kbd>Shift</kbd><kbd>/</kbd>
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="pb-2">
            <div className="keyboard-shortcut-title pb-1">{gettext('General')}</div>
            {this.renderContainer(['P'], gettext('Open priority panel'))}
            {this.renderContainer(['A'], gettext('Open assignees panel'))}
            {this.renderContainer(['T'], gettext('Open tags panel'))}
            {this.renderContainer(['S'], gettext('Open states panel'))}
            {this.renderContainer(['Shift', 'S'], gettext('Open substates panel'))}
            {this.renderContainer(['Shift', 'T'], gettext('Open types panel'))}
            {this.renderContainer(['Shift', '/'], gettext('Open keyboard shortcuts'))}
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

KeyboardShortcuts.propTypes = propTypes;

export default KeyboardShortcuts;
