import React from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import PropTypes from 'prop-types';
import { IconButton } from '@/components';
import { gettext } from '@/constants';
import SelectProjectIconContent from '../components/select-project-icon-content';

import './select-project-icon-dialog.css';

const propTypes = {
  bgColor: PropTypes.string,
  currentIcon: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
};

class SelectProjectIconDialog extends React.Component {

  onSelectIcon = (icon) => {
    this.props.onSelect(icon);
    this.props.onBack();
  };

  onBackKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.props.onBack();
    }
  };

  render() {
    const { bgColor, currentIcon, onBack } = this.props;
    return (
      <Modal
        isOpen={true}
        toggle={onBack}
        autoFocus={false}
        className="select-project-icon-dialog"
        zIndex={1071}
      >
        <ModalHeader className="select-project-icon-dialog-header">
          <IconButton
            icon="arrow-left"
            className="select-project-icon-dialog-back"
            role="button"
            tabIndex={0}
            title={gettext('Back')}
            aria-label={gettext('Back')}
            onClick={onBack}
            onKeyDown={this.onBackKeyDown}
          />
          <span>{gettext('Select Icon')}</span>
        </ModalHeader>
        <ModalBody>
          <SelectProjectIconContent
            currentIcon={currentIcon}
            bgColor={bgColor}
            onPrevious={onBack}
            onSubmit={this.onSelectIcon}
          />
        </ModalBody>
      </Modal>
    );
  }
}

SelectProjectIconDialog.propTypes = propTypes;

export default SelectProjectIconDialog;
