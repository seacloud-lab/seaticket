import { forwardRef, useState, useRef, useMemo, useCallback, useImperativeHandle, useEffect } from 'react';
import classnames from 'classnames';
import SearchInput from '../../search-input';
import Collaborator from '../../collaborator/collaborator';
import { searchCollaborators } from '@/utils/search';
import IconButton from '../../icon-button';
import { KeyCodes } from '@constants/keyCodes';
import { isFunction } from '@utils/type-detection';
import { isEsc, isEnter, isUpArrow, isDownArrow, isTab } from '@/utils/hotkey';

import './index.css';

const Main = forwardRef(({
  isShowDeleteArea = true,
  isSearchEnabled = true,
  isMultiple = true,
  placeholder,
  emptyTip,
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
    if (searchValue) return searchCollaborators([
      {
        'email': 'aaaf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'aaaa',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'bbbbf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'aa1',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'ccccf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'aa2',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'ddddf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'aa3',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'eeeef8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'eeee',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'fffff8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'ffff',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'hhhhf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'hhhhh',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'jjjjf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'jjjj',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'oooof8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'ooooo',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'kkkkf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'kkkkk',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'wwwwf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'wwwwww',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      }
    ], searchValue);
    // return collaborators;
    return [
      {
        'email': 'aaaf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'aaaa',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'bbbbf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'bbbb',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'ccccf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'cccc',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'ddddf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'dddd',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'eeeef8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'eeee',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'fffff8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'ffff',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'hhhhf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'hhhhh',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'jjjjf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'jjjj',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'oooof8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'ooooo',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'kkkkf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'kkkkk',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      },
      {
        'email': 'wwwwf8d2fb419e7c40dbb075428aef4b69bc@auth.local',
        'name': 'wwwwww',
        'avatar_url': 'http://127.0.0.1:80/media/avatars/default.png',
        'contact_email': 'test1@qq.com',
        'name_pinyin': ''
      }
    ];
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
    <div className="collaborator-editor-container">
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
            size={28}
            placeholder={placeholder}
            onKeyDown={onKeyDown}
            onChange={onSearchValueChange}
          />
        </div>
      )}
      <div
        className={classnames('collaborator-editor-content', { 'empty': displayCollaborators.length === 0 })}
        style={{ maxHeight }}
        ref={displayCollaboratorsRef}
      >
        {displayCollaborators.length === 0 ? (
          <div className="tip-default">{emptyTip}</div>
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
