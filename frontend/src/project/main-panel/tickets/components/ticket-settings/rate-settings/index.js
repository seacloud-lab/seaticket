import React, { useCallback, useRef, useState } from 'react';
import { Label } from 'reactstrap';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon } from '@/components';
import CustomizePopover from '@/components/customize-popover';
import RateItem from '@/sea-metadata/components/cell-editors/rate-editor/rate-item';
import { RATE_LIST } from '@/sea-metadata/components/cell-editors/rate-editor/constants';

import './index.css';

const RateSettings = ({
  isReadonly,
  value,
  className = 'mb-4',
  onChange,
}) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const editorRef = useRef(null);

  const openEditor = useCallback(() => {
    if (isReadonly) return;
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onChangeValue = useCallback((value) => {
    onChange(value);
    closeEditor();
  }, [onChange]);

  const rateOption = RATE_LIST.find(o => o.value === value);

  return (
    <>
      <div className={classnames('sea-qa-project-ticket-settings-item', className)}>
        <Label>{gettext('Priority')}</Label>
        <div className="ticket-rate-formatter" id="ticket-rate-formatter" onClick={openEditor} ref={editorRef}>
          <div className={classnames('d-flex align-items-center', { 'tip-default': !rateOption.value })}>
            {rateOption.value ? (<Icon className="mr-1" symbol={rateOption.icon} title={rateOption.name}/>) : '' }
            {gettext(rateOption.name)}
          </div>
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <CustomizePopover
          target={'ticket-rate-formatter'}
          className={classnames('sea-metadata-rate-editor-popover-container')}
          hidePopover={closeEditor}
          hidePopoverWithEsc={closeEditor}
          modifiers={[
            { name: 'preventOverflow', options: { boundary: document.body } },
            { name: 'offset', options: { offset: [-6, 8] } }
          ]}
        >
          <div className="sea-metadata-rate-editor-popover">
            {RATE_LIST.map((item, index) => (
              <RateItem
                key={index}
                value={item.value}
                hotKey={item.hotKey}
                onClick={onChangeValue}
                readOnly={false}
                isSelected={item.value === value}
              />
            ))}
          </div>
        </CustomizePopover>
      )}
    </>
  );
};

export default RateSettings;
