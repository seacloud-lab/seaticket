import { forwardRef, useState, useRef, useMemo, useCallback, useImperativeHandle, useEffect } from 'react';
import classnames from 'classnames';
import SearchInput from '../../search-input';
import Collaborator from '../../collaborator/collaborator';
import { searchCollaborators } from '@/utils/search';
import IconButton from '../../icon-button';
import { KeyCodes } from '@constants/keyCodes';
import { isFunction } from '@utils/type-detection';
import { isEsc, isEnter, isUpArrow, isDownArrow, isTab } from '@/utils/hotkey';
import { gettext, mediaUrl } from '@/constants';

import './index.css';
import { EmptyTip } from '@/components';

const Main = forwardRef(({
  id,
  isShowDeleteArea = true,
  isSearchEnabled = true,
  isMultiple = true,
  placeholder,
  emptyTip = gettext('No results'),
  value: propsValue = [],
  collaborators = [],
  maxHeight = 200,
  optionHeight = 30,
  onPressTab,
  onChange,
  onToggle,
  onHidden,
}, ref) => {
  const [value, setValue] = useState(propsValue || (isMultiple ? [] : ''));
  const [searchValue, setSearchValue] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const displayCollaborators = useMemo(() => {
    if (searchValue) return searchCollaborators(collaborators, searchValue);
    return collaborators;
  }, [collaborators, searchValue]);

  const displayCollaboratorsRef = useRef(null);

  const collaboratorsMap = useMemo(() => {
    return collaborators.reduce((pre, cur) => {
      pre[cur.email] = cur;
      return pre;
    }, {});
  }, [collaborators]);

  const maxItemNum = useMemo(() => Math.floor(parseInt(maxHeight) / parseInt(optionHeight)) - 1, [maxHeight, optionHeight]);

  const onSearchValueChange = useCallback((newSearchValue) => {
    if (searchValue === newSearchValue) return;
    setSearchValue(newSearchValue);
  }, [collaborators, searchValue]);

  const removeCollaborator = useCallback((email) => {
    const newValue = value.filter(i => i !== email);
    setValue(newValue);
  }, [value]);

  const toggleCollaborator = useCallback((email) => {
    if (isMultiple) {
      let newValue = Array.isArray(value) ? value.slice(0) : [];
      const optionIndex = newValue.findIndex(v => v === email);
      if (optionIndex === -1) {
        newValue.push(email);
      } else {
        newValue.splice(optionIndex, 1);
      }
      setValue(newValue);
      onChange && onChange(newValue);
      return;
    }
    const newValue = email === value ? '' : email;
    setValue(newValue);
    onChange && onChange(newValue);
    onToggle && onToggle();
  }, [value, isMultiple, onToggle, onChange]);

  const onMenuMouseEnter = useCallback((highlightIndex) => {
    setHighlightIndex(highlightIndex);
  }, []);

  const onMenuMouseLeave = useCallback(() => {
    setHighlightIndex(-1);
  }, []);

  const onEnter = useCallback((event) => {
    event.preventDefault();
    let collaborator;
    if (displayCollaborators.length === 1) {
      collaborator = displayCollaborators[0];
    } else if (highlightIndex > -1) {
      collaborator = displayCollaborators[highlightIndex];
    }
    if (!collaborator) return;
    toggleCollaborator(collaborator.email);
  }, [displayCollaborators, highlightIndex, toggleCollaborator]);

  const onUpArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex > 0) {
      setHighlightIndex(highlightIndex - 1);
      if (highlightIndex < displayCollaborators.length - maxItemNum) {
        displayCollaboratorsRef.current.scrollTop -= optionHeight;
      }
    } else {
      setHighlightIndex(displayCollaborators.length - 1);
      displayCollaboratorsRef.current.scrollTop = displayCollaboratorsRef.current.scrollHeight;
    }
  }, [displayCollaboratorsRef, highlightIndex, maxItemNum, displayCollaborators, optionHeight]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex < displayCollaborators.length - 1) {
      setHighlightIndex(highlightIndex + 1);
      if (highlightIndex >= maxItemNum) {
        displayCollaboratorsRef.current.scrollTop += optionHeight;
      }
    } else {
      setHighlightIndex(0);
      displayCollaboratorsRef.current.scrollTop = 0;
    }
  }, [displayCollaboratorsRef, highlightIndex, maxItemNum, displayCollaborators, optionHeight]);

  const onEsc = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    onHidden && onHidden();
    setHighlightIndex(-1);
  }, [onHidden]);

  const onHotKey = useCallback((event) => {
    if (isEnter(event)) {
      onEnter(event);
    } else if (isUpArrow(event)) {
      onUpArrow(event);
    } else if (isDownArrow(event)) {
      onDownArrow(event);
    } else if (isTab(event)) {
      if (isFunction(onPressTab)) {
        onPressTab(event);
      }
    } else if (isEsc(event)) {
      onEsc(event);
    }
  }, [onEnter, onUpArrow, onDownArrow, onPressTab, onEsc]);

  const onKeyDown = useCallback((event) => {
    if (
      event.keyCode === KeyCodes.ChineseInputMethod ||
      event.keyCode === KeyCodes.LeftArrow ||
      event.keyCode === KeyCodes.RightArrow
    ) {
      event.stopPropagation();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey, true);
    return () => {
      document.removeEventListener('keydown', onHotKey, true);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onHotKey]);

  useEffect(() => {
    // Reset highlight index
    setHighlightIndex(-1);
  }, [displayCollaborators]);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
  }), [value]);

  return (
    <div className="collaborator-editor-container" id={id}>
      {isMultiple && isShowDeleteArea && (
        <div className="collaborator-editor-selected-container">
          {Array.isArray(value) && value.map(email => {
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
      {isSearchEnabled && (
        <div className="collaborator-editor-search-wrapper">
          <SearchInput
            isShowSearchIcon={false}
            autoFocus={true}
            value={searchValue}
            size={30}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
          />
        </div>
      )}
      <div
        className={classnames('collaborator-editor-content', { 'search-enabled': isSearchEnabled })}
        style={{ maxHeight }}
        ref={displayCollaboratorsRef}
      >
        {displayCollaborators.length === 0 ? (
          <EmptyTip text={emptyTip} src={`${mediaUrl}img/no-results.png`} className="collaborator-editor-no-results-tip" />
        ) : (
          <>
            {displayCollaborators.map((c, i) => {
              const isSelected = isMultiple && Array.isArray(value) && value.includes(c.email);
              return (
                <div
                  className={classnames('collaborator-editor-option', { 'active': highlightIndex === i })}
                  key={c.email}
                  onClick={() => toggleCollaborator(c.email)}
                  onMouseEnter={() => onMenuMouseEnter(i)}
                  onMouseLeave={() => onMenuMouseLeave(i)}
                >
                  <Collaborator collaborator={c} />
                  <IconButton icon={isSelected ? 'check-mark-option' : ''} className="option-editor-option-check-btn no-hover-bg ml-3" />
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
});

export default Main;
