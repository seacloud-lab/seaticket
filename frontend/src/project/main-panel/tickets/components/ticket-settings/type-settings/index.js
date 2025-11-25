import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor } from '@/components';
import { useMetadata } from '../../../hooks';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const TypeSettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, typesData } = useMetadata();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    return typesData ? typesData.rows.map(o => ({
      ...o,
      value: o._id,
    })) : [];
  }, [isLoading, typesData.rows]);

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

  const typeOption = getRowById(typesData, value);

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
