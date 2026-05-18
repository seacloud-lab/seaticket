import React, { useCallback, useRef, useState } from 'react';
import { SyncOptionEditor } from '@/components';
import { gettext } from '@/constants';
import SelectorDisplay from './selector-display';

import './index.css';

const SyncSelector = ({ icon, className, value, title, onChange, children, onSearch }) => {
  const [isShowSelector, setIsShowSelector] = useState(false);

  const ref = useRef();

  const openSelector = useCallback(() => {
    setIsShowSelector(true);
  }, []);

  const handleChange = useCallback((newValue) => {
    onChange && onChange(newValue);
  }, [onChange]);

  const onToggle = useCallback(() => {
    setIsShowSelector(false);
  }, []);

  return (
    <>
      <SelectorDisplay
        innerRef={ref}
        onClick={openSelector}
        icon={icon}
        className={className}
        tip={title}
        tipPlacement="top-start"
      >
        {children}
      </SelectorDisplay>
      {isShowSelector && (
        <SyncOptionEditor
          className="seaqa-ai-chat-selector-display-editor "
          target={ref}
          isMultiple={true}
          placeholder={gettext('Search')}
          emptyTip={gettext('No results')}
          value={Array.isArray(value) ? value : []}
          placement="top-start"
          onChange={handleChange}
          onToggle={onToggle}
          onSearch={onSearch}
        />
      )}
    </>
  );

};

export default SyncSelector;
