import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor } from '@/components';
import { useMetadata } from '../../../hooks';
import { getRowById } from '@/sea-metadata/utils/row';

import '../state-settings/index.css';

const SubStateSettings = ({
  isReadonly,
  state,
  substate,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);

  const { isLoading, substatesData } = useMetadata();

  const editorRef = useRef(null);

  const options = useMemo(() => {
    if (isLoading) return [];
    const rows = substatesData.rows.filter(r => r.parent_id === state);
    return rows.map(row => {
      return {
        ...row,
        value: row._id,
      };
    });
  }, [state]);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onStateChange = useCallback((value) => {
    if (!value) return;
    const [state, substate] = value.split('__');
    onChange(state, substate);
  }, [onChange]);

  const substateOption = !isLoading && getRowById(substatesData, substate);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Substate')}</Label>
        <div className="ticket-state-formatter" onClick={openEditor} ref={editorRef}>
          {substateOption && (<Option option={substateOption} />)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <OptionEditor
          target={editorRef}
          isMultiple={false}
          isSearchEnabled={false}
          value={substate}
          options={options}
          onChange={onStateChange}
          onToggle={closeEditor}
        />
      )}
    </>
  );
};

export default SubStateSettings;
