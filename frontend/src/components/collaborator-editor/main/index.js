import { forwardRef, useState, useRef, useMemo, useCallback, useImperativeHandle, useEffect } from 'react';
import SearchInput from '../../search-input';
import Collaborator from '../../collaborator/collaborator';
import { searchCollaborators } from '../../../utils/search';
import IconButton from '../../icon-button';
import { KeyCodes } from '@constants/keyCodes';
import { isFunction } from '@utils/utils';

import './index.css';

const Main = forwardRef(({
  isShowDeleteArea = true,
  placeholder,
  emptyTip,
  value: propsValue = [],
  collaborators = [],
  maxHeight = 200,
  optionHeight = 30,
  onPressTab,
  onChange,
}, ref) => {
  const [value, setValue] = useState(propsValue);
  const [searchValue, setSearchValue] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const displayCollaboratorsRef = useRef(null);
  const displayCollaborators = useRef(collaborators);

  const collaboratorsMap = useMemo(() => {
    return collaborators.reduce((pre, cur) => {
      pre[cur.email] = cur;
      return pre;
    }, {});
  }, [collaborators]);

  const maxItemNum = useMemo(() => Math.floor(parseInt(maxHeight) / parseInt(optionHeight)) - 1, [maxHeight, optionHeight]);

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
    if (highlightIndex === 0) {
      setHighlightIndex(displayCollaborators.length - 1);
      displayCollaboratorsRef.current.scrollTop = 0;
      return;
    }
    setHighlightIndex(highlightIndex - 1);
    if (highlightIndex > displayCollaborators.length - maxItemNum) {
      displayCollaboratorsRef.current.scrollTop -= optionHeight;
    }
  }, [displayCollaboratorsRef, highlightIndex, maxItemNum, displayCollaborators, optionHeight]);

  const onDownArrow = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (highlightIndex === displayCollaborators.length - 1) {
      setHighlightIndex(0);
      displayCollaboratorsRef.current.scrollTop = 0;
      return;
    }
    setHighlightIndex(highlightIndex + 1);
    if (highlightIndex >= maxItemNum) {
      displayCollaboratorsRef.current.scrollTop += optionHeight;
    }
  }, [displayCollaboratorsRef, highlightIndex, maxItemNum, displayCollaborators, optionHeight]);

  const blur = useCallback(() => {
    onChange && onChange();
  }, [onChange]);

  const onEsc = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    blur();
  }, [blur]);

  const onHotKey = useCallback((event) => {
    if (event.keyCode === KeyCodes.Enter) {
      onEnter(event);
    } else if (event.keyCode === KeyCodes.UpArrow) {
      onUpArrow(event);
    } else if (event.keyCode === KeyCodes.DownArrow) {
      onDownArrow(event);
    } else if (event.keyCode === KeyCodes.Tab) {
      if (isFunction(onPressTab)) {
        onPressTab(event);
      }
    } else if (event.keyCode === KeyCodes.Esc) {
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
    const highlightIndex = displayCollaborators.length === 0 ? -1 : 0;
    setHighlightIndex(highlightIndex);
  }, [displayCollaborators]);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
  }), [value]);

  return (
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
        <SearchInput isShowSearchIcon={false} value={searchValue} size={28} placeholder={placeholder} onKeyDown={onKeyDown} onChange={onSearchValueChange} />
      </div>
      <div className="collaborator-editor-content" style={{ maxHeight }} ref={displayCollaboratorsRef}>
        {displayCollaborators.current.length === 0 ? (
          <div className="tip-default p-4">{emptyTip}</div>
        ) : (
          <>
            {displayCollaborators.current.map((c, i) => {
              const isSelected = value.includes(c.email);
              return (
                <div
                  className="collaborator-editor-option"
                  key={c.email}
                  onClick={() => toggleCollaborator(c.email)}
                  onMouseEnter={() => onMenuMouseEnter(i)}
                  onMouseLeave={() => onMenuMouseLeave(i)}
                >
                  <Collaborator collaborator={c} />
                  <IconButton icon={isSelected ? 'check-mark' : ''} className="no-hover-bg" />
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
