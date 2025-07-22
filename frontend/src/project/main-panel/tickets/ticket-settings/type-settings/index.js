import React, { useCallback, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '../../../../../constants';
import { Option, OptionEditor } from '../../../../../components';
import { TICKET_TYPES } from '../../../../constants';

import './index.css';

const TypeSettings = ({
  isReadonly,
  type,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowTypeEditor, setIsShowTypeEditor] = useState(false);

  const typeEditorRef = useRef(null);

  const openTypeEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowTypeEditor(true);
  }, [isReadonly]);

  const closeTypeEditor = useCallback(() => {
    setIsShowTypeEditor(false);
  }, []);

  const onTypeChange = useCallback((type) => {
    onChange(type);
  }, [onChange]);

  const typeOption = TICKET_TYPES.find(o => o.id === type);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Type')}</Label>
        <div className="ticket-types-formatter" onClick={openTypeEditor} ref={typeEditorRef}>
          {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
        </div>
      </div>
      {!isReadonly && isShowTypeEditor && (
        <OptionEditor
          target={typeEditorRef}
          isMultiple={false}
          value={type}
          placeholder={gettext('Select type')}
          emptyTip={gettext('No types')}
          options={TICKET_TYPES}
          onChange={onTypeChange}
          onClose={closeTypeEditor}
        />
      )}
    </>
  );
};

export default TypeSettings;
