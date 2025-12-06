import React, { forwardRef, useCallback, useEffect, useState, useImperativeHandle, useRef } from 'react';
import { Button, Input } from 'reactstrap';
import classnames from 'classnames';
import { IconButton, toaster } from '@/components';
import { gettext } from '@/constants';
import { isEnter, isEsc } from '@/utils/hotkey';
import { validateTitle } from '@/utils/validate';

import './index.css';

const Header = forwardRef(({
  readonly = true,
  className,
  question: propsQuestion,
  id,
  copyLink,
  modifyQuestion,
}, ref) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [question, setQuestion] = useState(propsQuestion);

  const domRef = useRef(null);

  const handleCancelModify = useCallback(() => {
    setQuestion(propsQuestion);
    setIsRenaming(false);
  }, [propsQuestion]);

  const handleModify = useCallback(() => {
    const { isValid, message } = validateTitle(question);
    if (!isValid) {
      toaster.danger(message);
      return;
    }
    if (propsQuestion === message) {
      setIsRenaming(false);
      return;
    }
    modifyQuestion(message, (error) => {
      if (!error) {
        setIsRenaming(false);
      }
    });
  }, [question, propsQuestion, modifyQuestion]);

  const onChange = useCallback((event) => {
    const newQuestion = event.target.value;
    if (newQuestion === question) return;
    setQuestion(newQuestion);
  }, [question]);

  const onKeyDown = useCallback((event) => {
    if (isEsc(event)) {
      handleCancelModify();
    }
    if (isEnter(event)) {
      handleModify();
    }
  }, [handleCancelModify, handleModify]);

  useEffect(() => {
    if (!readonly) return;
    setQuestion(propsQuestion);
  }, [readonly, propsQuestion]);

  useImperativeHandle(ref, () => ({
    getDom: () => domRef.current,
  }), [domRef]);

  return (
    <div className={classnames('sea-qa-project-knowledge-header', className)} ref={domRef}>
      <div className="sea-qa-project-knowledge-title-wrapper">
        <div className={classnames('sea-qa-project-knowledge-title-wrapper-left', { 'o-hidden': !isRenaming })}>
          <div className={classnames('sea-qa-project-knowledge-title-number', { 'w-100': isRenaming, 'o-hidden': !isRenaming })}>
            {isRenaming ? (
              <Input value={question} autoFocus={true} className="sea-qa-project-knowledge-title-input" onChange={onChange} onKeyDown={onKeyDown} />
            ) : (
              <>
                <span title={question} className="sea-qa-project-knowledge-title">{question}</span>
                <span className="sea-qa-project-knowledge-number">{`#${id}`}</span>
              </>
            )}
            {!readonly && !isRenaming && (
              <IconButton icon="rename" className="sea-qa-project-knowledge-rename-btn" onClick={() => setIsRenaming(true)} />
            )}
          </div>
        </div>
        <div className="sea-qa-project-knowledge-title-wrapper-right">
          {isRenaming ? (
            <>
              <Button className="sea-qa-project-knowledge-title-cancel-btn" onClick={handleCancelModify}>
                {gettext('Cancel')}
              </Button>
              <Button className="sea-qa-project-knowledge-title-submit-btn" color="primary" onClick={handleModify}>
                {gettext('Submit')}
              </Button>
            </>
          ) : (
            <IconButton icon="copy" className="sea-qa-project-knowledge-copy" onClick={copyLink} />
          )}
        </div>
      </div>
    </div>
  );
});

export default Header;
