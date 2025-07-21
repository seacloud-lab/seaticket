import React, { useCallback, useMemo, useRef, useState } from 'react';
import CustomizePopover from '../customize-popover';
import SearchInput from '../search-input';
import Collaborator from '../collaborator';
import { searchCollaborators } from '../../utils/search';
import IconButton from '../icon-button';

import './index.css';

const CollaboratorEditor = ({
  target,
  isShowDeleteArea = true,
  placeholder,
  emptyTip,
  value: propsValue = [],
  collaborators = [],
  onChange,
  onClose,
}) => {
  const [value, setValue] = useState(propsValue);
  const [searchValue, setSearchValue] = useState('');

  const displayCollaborators = useRef(collaborators);

  const collaboratorsMap = useMemo(() => {
    return collaborators.reduce((pre, cur) => {
      pre[cur.email] = cur;
      return pre;
    }, {});
  }, [collaborators]);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    displayCollaborators.current = searchCollaborators(collaborators, newSearchValue);
    setSearchValue(newSearchValue);
  }, [collaborators, searchValue]);

  const removeCollaborator = useCallback((email) => {
    const newValue = value.filter(i => i !== email);
    setValue(newValue);
  }, [value]);

  const toggleCollaborator = useCallback((email) => {
    const newValue = value.includes(email) ? value.filter(i => i !== email) : [...value, email];
    setValue(newValue);
  }, [value]);

  const handleSubmit = useCallback(() => {
    onChange(value);
    onClose();
  }, [value, onChange, onClose]);

  return (
    <CustomizePopover
      target={target}
      popoverClassName="collaborator-editor-popover"
      hidePopover={handleSubmit}
      hidePopoverWithEsc={handleSubmit}
    >
      <div className="collaborator-editor-container">
        {isShowDeleteArea && (
          <div className="collaborator-editor-selected-container">
            {value.map(email => {
              const collaborator = collaboratorsMap[email];
              if (!collaborator) return null;
              return (
                <Collaborator collaborator={collaborator} key={email}>
                  <Collaborator.RemoveBtn callback={() => removeCollaborator(email)} />
                </Collaborator>
              );
            })}
          </div>
        )}
        <div className="collaborator-editor-search-wrapper">
          <SearchInput isShowSearchIcon={false} value={searchValue} size={28} placeholder={placeholder} onChange={onSearchValueChange} />
        </div>
        <div className="collaborator-editor-content">
          {displayCollaborators.current.length === 0 ? (
            <div className="tip-default p-4">{emptyTip}</div>
          ) : (
            <>
              {displayCollaborators.current.map(c => {
                const isSelected = value.includes(c.email);
                return (
                  <div className="collaborator-editor-option" key={c.email} onClick={() => toggleCollaborator(c.email)}>
                    <Collaborator collaborator={c} />
                    <IconButton icon={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </CustomizePopover>

  );
};

export default CollaboratorEditor;
