import React, { useCallback, useMemo, useState } from 'react';
import { Button, Input } from 'reactstrap';
import { gettext } from '@constants';
import { Loading, toaster } from '@/components';

import './index.css';

const ReplyDiscourse = ({ onToggle, onSubmit }) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ableSubmitting = useMemo(() => {
    return content.trim() && !isSubmitting;
  }, [content, isSubmitting]);

  const onContentChange = useCallback((e) => {
    setContent(e.target.value);
  }, []);

  const handleSubmit = useCallback(() => {
    if (content.length < 6) {
      toaster.danger(gettext('The content is too short, at least 6 characters.'));
      return;
    }
    setIsSubmitting(true);
    onSubmit({ content: content.trim() }, (error) => {
      if (error) {
        setIsSubmitting(false);
        return;
      }
      onToggle();
    });
  }, [content, onToggle, onSubmit]);

  return (
    <div className="sea-ticket-discourse-reply-container">
      <Input
        type="textarea"
        value={content}
        onChange={onContentChange}
        placeholder={gettext('Write your reply...')}
        rows={4}
      />
      <div className="sea-ticket-discourse-reply-op-btns">
        <Button color="secondary" onClick={onToggle}>{gettext('Cancel')}</Button>
        <Button color="primary" disabled={!ableSubmitting} onClick={handleSubmit}>
          {isSubmitting ? (<Loading />) : (<>{gettext('Submit')}</>)}
        </Button>
      </div>
    </div>
  );
};

export default ReplyDiscourse;
