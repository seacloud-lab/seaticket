import React, { useState, useCallback, useMemo } from 'react';
import { Input, Button } from 'reactstrap';
import { gettext } from '@/constants';
import { isEnter, isEsc } from '@/utils/hotkey';
import { Loading } from '@/components';

import './index.css';

const Rename = ({
  title: propsTitle,
  onToggle,
  onSubmit,
}) => {
  const [title, setTitle] = useState(propsTitle);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabled = useMemo(() => title === propsTitle || !title || isSubmitting, [title, propsTitle, isSubmitting]);

  const handleModify = useCallback(() => {
    setIsSubmitting(true);
    onSubmit({ title }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [title, propsTitle, onSubmit, onToggle]);

  const onChange = useCallback((event) => {
    const newTitle = event.target.value;
    if (newTitle === title) return;
    setTitle(newTitle);
  }, [title]);

  const onKeyDown = useCallback((event) => {
    if (isEsc(event)) {
      onToggle();
    }
    if (isEnter(event)) {
      handleModify();
    }
  }, [onToggle, handleModify]);

  return (
    <div className="seaqa-rename-connection-title">
      <Input
        value={title}
        autoFocus={true}
        readOnly={isSubmitting}
        className="seaqa-rename-connection-title-input"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      <Button className="seaqa-rename-connection-title-cancel-btn" onClick={onToggle}>
        {gettext('Cancel')}
      </Button>
      <Button className="seaqa-rename-connection-title-submit-btn" color="primary" disabled={disabled} onClick={handleModify}>
        {isSubmitting ? (<Loading />) : gettext('Submit')}
      </Button>
    </div>
  );
};

export default Rename;
