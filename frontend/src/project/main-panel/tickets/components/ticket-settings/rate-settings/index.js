import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Option, OptionEditor } from '@/components';
import CustomizePopover from '@/components/customize-popover';
import { RATE_LIST } from './constants';
import { useTypes } from '../../../hooks';

import './index.css';

const RateSettings = ({
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
        <Label>{gettext('priority')}</Label>
        <div className='ticket-rate-formatter' onClick={openEditor} ref={editorRef}>
          {typeOption ? (<Option option={typeOption} />) : (<div className="tip-default">{gettext('No priority')}</div>)}
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
        // <CustomizePopover
        //   target={`rate-editor-${column.key}-${row._id}`}
        //   className={classnames('sea-metadata-rate-editor-popover-container')}
        //   hidePopover={() => setIsOpen(false)}
        //   hidePopoverWithEsc={() => setIsOpen(false)}
        //   modifiers={[
        //     { name: 'preventOverflow', options: { boundary: document.body } },
        //     { name: 'offset', options: { offset: [-6, 8] } }
        //   ]}
        // >
        //   <div className="sea-metadata-rate-editor-popover">
        //     {RATE_LIST.map((item, index) => (
        //       <RateItem
        //         key={index}
        //         value={item.value}
        //         hotKey={item.hotKey}
        //         onClick={onChangeValue}
        //         readOnly={false}
        //         isSelected={item.value === value}
        //       />
        //     ))}
        //   </div>
        // </CustomizePopover>
      )}
    </>
  );
};

export default RateSettings;
