import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor } from '@/components';
import { useMetadata } from '../../../hooks';
import { getRowById } from '@/sea-metadata/utils/row';

import './index.css';

const StateSettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, statesData } = useMetadata();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    return statesData ? statesData.rows.map(o => ({
      ...o,
      value: o._id,
    })) : [];
  }, [isLoading, statesData.rows]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onStateChange = useCallback((state) => {
    if (!state) return;
    onChange(state);
  }, [onChange]);

  const stateOption = getRowById(statesData, value);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Type')}</Label>
        <div className="ticket-state-formatter" onClick={openEditor} ref={editorRef}>
          {stateOption ? (<Option option={stateOption} />) : (<div className="tip-default">{gettext('No type')}</div>)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          target={editorRef}
          isMultiple={false}
          isSearchEnabled={false}
          value={value}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default StateSettings;
