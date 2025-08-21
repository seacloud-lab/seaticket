import { useCallback, useState } from 'react';
import { Modal, ModalBody, ModalFooter, Alert, Input } from 'reactstrap';
import { gettext } from '../../constants';
import { Utils, validateName } from '../../utils/utils';
import ModalHeader from '../modal-header';

const CustomizeNameDialog = ({
  title,
  value: oldValue,
  onToggle,
  onSubmit,
}) => {
  const [value, setValue] = useState(oldValue);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onValueChange = useCallback((event) => {
    const newValue = event.target.value;
    setValue(newValue);
  }, []);

  const handleSubmit = useCallback(() => {
    setSubmitting(true);
    const { isValid, message } = validateName(value);
    if (!isValid) {
      setErrorMessage(message);
      setSubmitting(false);
      return;
    }
    onSubmit(value).then(() => {
      onToggle();
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      setErrorMessage(errorMessage);
      setSubmitting(false);
    });
  }, [value, onSubmit]);

  return (
    <Modal isOpen={true} centered={true} autoFocus={false} toggle={onToggle}>
      <ModalHeader toggle={onToggle}>{title || gettext('New')}</ModalHeader>
      <ModalBody>
        <Input value={value} autoFocus onChange={onValueChange} />
        {errorMessage && <Alert>{errorMessage}</Alert>}
      </ModalBody>
      <ModalFooter>
        <button className="btn btn-secondary" onClick={onToggle}>{gettext('Cancel')}</button>
        <button className="btn btn-primary" disabled={!value || isSubmitting} onClick={handleSubmit}>{gettext('Submit')}</button>
      </ModalFooter>
    </Modal>
  );
};

export default CustomizeNameDialog;
