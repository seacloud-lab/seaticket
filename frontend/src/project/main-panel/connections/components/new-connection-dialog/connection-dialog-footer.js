import React from 'react';
import { Button, ModalFooter } from 'reactstrap';
import PropTypes from 'prop-types';
import { gettext } from '@/constants';

const ConnectionDialogFooter = ({ stepIndex, isSubmitDisabled, onToggle, setStepIndex, onSubmit }) => {
  if (stepIndex === 0) {
    return (
      <ModalFooter className="seaqa-project-new-connection-footer">
        <Button type="button" color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button type="button" color="primary" onClick={() => setStepIndex(1)}>{gettext('Next')}</Button>
      </ModalFooter>
    );
  }
  if (stepIndex === 1) {
    return (
      <ModalFooter>
        <Button color="secondary" onClick={() => setStepIndex(0)}>{gettext('Previous')}</Button>
        <Button color="primary" onClick={onSubmit} disabled={isSubmitDisabled}>{gettext('Submit')}</Button>
      </ModalFooter>
    );
  }
  return null;
};

ConnectionDialogFooter.propTypes = {
  stepIndex: PropTypes.number.isRequired,
  isSubmitDisabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  setStepIndex: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default ConnectionDialogFooter;
