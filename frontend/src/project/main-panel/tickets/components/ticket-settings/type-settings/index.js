import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor } from '@/components';
import { useTypes } from '../../../hooks';

import './index.css';

const TypeSettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { typesData } = useTypes();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    return typesData.rows.map(o => ({
      ...o,
      value: o.id,
    }));
  }, [typesData.rows]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onTypeChange = useCallback((type) => {
    onChange(type);
  }, [onChange]);

  const typeOption = options.find(o => o.value === value);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Type')}</Label>
        <div className="ticket-types-formatter" onClick={openEditor} ref={editorRef}>
          {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          target={editorRef}
          isMultiple={false}
          value={value}
          placeholder={gettext('Search type')}
          emptyTip={gettext('No types')}
          options={options}
          onChange={onTypeChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default TypeSettings;
