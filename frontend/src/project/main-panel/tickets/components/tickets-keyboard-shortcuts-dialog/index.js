import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Modal, ModalBody } from 'reactstrap';
import { gettext } from '@/constants';
import { ModalHeader } from '@/components';
import { isMac } from '@/utils/utils';

import './index.css';

const propTypes = {
  toggle: PropTypes.func.isRequired,
};

const controlKey = isMac() ? '⌘' : 'CTRL';

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
    const isMacSystem = isMac();
    return (
      <Modal isOpen={true} toggle={toggle} className="keyboard-shortcut-dialog">
        <ModalHeader toggle={toggle}>
          <span className="mr-2">{gettext('Keyboard shortcuts')}</span>
          <span className="keyboard-shortcut">
            <kbd>{controlKey}</kbd><kbd>?</kbd>
          </span>
        </ModalHeader>
        <ModalBody>
          <div>
            <div className="pb-2">
              <div className="keyboard-shortcut-title pb-1">{gettext('General')}</div>
              {this.renderContainer([controlKey, 'f'], gettext('Open find_bar'))}
              {this.renderContainer([controlKey, 'g'], gettext('View next result'))}
              {this.renderContainer([controlKey, 'shift', 'g'], gettext('View previous result'))}
            </div>
            <div className="pb-2">
              <div className="keyboard-shortcut-title pb-1">{gettext('Grid view')}</div>
              {this.renderContainer([controlKey, 'z'], gettext('Undo action'))}
              {this.renderContainer([controlKey, 'shift', 'z'], gettext('Redo action'))}
              {this.renderContainer([controlKey, ';'], gettext('Set the selected date or datetime column to now'))}
              {this.renderContainer([controlKey, 'p'], gettext('Print the current table view or current expanded record'))}
              {this.renderContainer([controlKey, 'c'], gettext('Copy a cell or range of cells'))}
              {this.renderContainer([controlKey, 'x'], gettext('Cut a cell or range of cells'))}
              {this.renderContainer([controlKey, 'l'], gettext('Lock/Unlock_row'))}
              {this.renderContainer([controlKey, 'v'], gettext('Paste a cell if you select a range of cells you can paste the same value into multiple cells at once'))}
              {this.renderContainer(['space'], gettext('Expand the selected record'))}
              <div className="keyboard-shortcut-container">
                <div className="col-3">
                  {this.renderShortcut(['pgup'])}
                  {this.renderShortcut(['pgdn'])}
                  {isMacSystem &&
                    <Fragment>
                      {this.renderShortcut(['fn', '↑'])}
                      {this.renderShortcut(['fn', '↓'])}
                    </Fragment>
                  }
                </div>
                <div className="col-9">{gettext('Scroll one screen up or down')}</div>
              </div>
              <div className="keyboard-shortcut-container">
                <div className="col-3">
                  {this.renderShortcut(['alt', 'pgup'])}
                  {this.renderShortcut(['alt', 'pgdn'])}
                  {isMacSystem &&
                    <Fragment>
                      {this.renderShortcut(['alt', 'fn', '↑'])}
                      {this.renderShortcut(['alt', 'fn', '↓'])}
                    </Fragment>
                  }
                </div>
                <div className="col-9">{gettext('Scroll one screen left or right')}</div>
              </div>
              <div className="keyboard-shortcut-container">
                <div className="col-3">
                  {this.renderShortcut([controlKey, '↑'])}
                  {this.renderShortcut([controlKey, '↓'])}
                  {this.renderShortcut([controlKey, '←'])}
                  {this.renderShortcut([controlKey, '→'])}
                </div>
                <div className="col-9">{gettext('Scroll to edge of table')}</div>
              </div>
              {this.renderContainer(['shift', 'enter'], gettext('Insert a record below the selected cell'))}
              <div className="keyboard-shortcut-container">
                <div className="col-3">
                  {this.renderShortcut([controlKey, 'shift'])}
                  {this.renderShortcut(['enter'])}
                </div>
                <div className="col-9">{gettext('Create and expand a new record')}</div>
              </div>
            </div>
            <div className="pb-2">
              <div className="keyboard-shortcut-title pb-1">{gettext('Expanded record')}</div>
              {this.renderContainer([controlKey, 'shift', ','], gettext('Previous record'))}
              {this.renderContainer([controlKey, 'shift', '.'], gettext('Next record'))}
              {this.renderContainer(['esc'], gettext('Close expanded record'))}
            </div>
          </div>
        </ModalBody>
      </Modal>
    );
  }
}

KeyboardShortcuts.propTypes = propTypes;

export default KeyboardShortcuts;
