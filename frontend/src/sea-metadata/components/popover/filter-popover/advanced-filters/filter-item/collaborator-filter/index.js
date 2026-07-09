import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ClickOutside, Icon } from '@/components';
import OptionEditorContainer from '@/components/option-editor/option-editor-container';
import { gettext } from '@/constants';
import { FILTER_PREDICATE_TYPE } from '../../../../../../constants';

import './index.css';

const SUPPORT_MULTIPLE_SELECT_OPTIONS = [
  FILTER_PREDICATE_TYPE.HAS_ANY_OF,
  FILTER_PREDICATE_TYPE.HAS_ALL_OF,
  FILTER_PREDICATE_TYPE.HAS_NONE_OF,
  FILTER_PREDICATE_TYPE.IS_EXACTLY,
];

const COLLABORATOR_FILTER_TEXT_MAP = {
  default: {
    placeholder: gettext('Select collaborators'),
    searchPlaceholder: gettext('Search collaborators'),
    removeItemText: gettext('Remove collaborator'),
    clearAllText: gettext('Clear all collaborators'),
    emptyTipText: gettext('No collaborators'),
  },
  creator: {
    placeholder: gettext('Select creator'),
    searchPlaceholder: gettext('Search creator'),
    removeItemText: gettext('Remove creator'),
    clearAllText: gettext('Clear all creators'),
    emptyTipText: gettext('No creators'),
  },
  assignees: {
    placeholder: gettext('Select assignees'),
    searchPlaceholder: gettext('Search assignees'),
    removeItemText: gettext('Remove assignee'),
    clearAllText: gettext('Clear all assignees'),
    emptyTipText: gettext('No assignees'),
  },
  participants: {
    placeholder: gettext('Select participants'),
    searchPlaceholder: gettext('Search participants'),
    removeItemText: gettext('Remove participant'),
    clearAllText: gettext('Clear all participants'),
    emptyTipText: gettext('No participants'),
  },
};

const getCollaboratorFilterText = (filterColumnName, key) => {
  const textMap = COLLABORATOR_FILTER_TEXT_MAP[filterColumnName] || COLLABORATOR_FILTER_TEXT_MAP.default;
  return textMap[key];
};

const CollaboratorFilter = ({ readOnly, filterTerm, collaborators, filter_predicate, onSelectCollaborator, filterColumn }) => {

  const [isShowEditor, setIsShowEditor] = useState(false);
  const optionEditorContainerRef = useRef(null);

  const isSupportMultipleSelect = useMemo(() => SUPPORT_MULTIPLE_SELECT_OPTIONS.includes(filter_predicate), [filter_predicate]);
  const filterColumnName = filterColumn?.name;
  const placeholder = getCollaboratorFilterText(filterColumnName, 'placeholder');
  const searchPlaceholder = getCollaboratorFilterText(filterColumnName, 'searchPlaceholder');
  const removeItemText = getCollaboratorFilterText(filterColumnName, 'removeItemText');
  const clearAllText = getCollaboratorFilterText(filterColumnName, 'clearAllText');
  const emptyTipText = getCollaboratorFilterText(filterColumnName, 'emptyTipText');

  const selectedCollaboratorEmails = useMemo(() => {
    if (isSupportMultipleSelect) {
      return Array.isArray(filterTerm) ? filterTerm.map(item => `${item}`).filter(Boolean) : [];
    }
    if (Array.isArray(filterTerm)) {
      return filterTerm.length > 0 ? [`${filterTerm[0]}`] : [];
    }
    return filterTerm ? [`${filterTerm}`] : [];
  }, [filterTerm, isSupportMultipleSelect]);

  const getCollaboratorByEmail = useCallback((email) => collaborators.find(c => c.email === email), [collaborators]);

  const normalizeSelectedValue = useCallback((value) => {
    if (isSupportMultipleSelect) {
      return Array.isArray(value)
        ? Array.from(new Set(value.map(v => `${v}`))).filter(Boolean)
        : [`${value}`].filter(Boolean);
    }

    return [`${Array.isArray(value) ? value[0] : value || ''}`].filter(Boolean);
  }, [isSupportMultipleSelect]);

  const options = useMemo(() => {
    if (!Array.isArray(collaborators)) return [];
    return collaborators.map((collaborator) => ({
      value: collaborator.email,
      name: collaborator.name,
      label: (
        <div className="select-option-name option-collaborator">
          <div className="collaborator-container">
            <div className="collaborator" title={collaborator.name}>
              <span className="collaborator-avatar">
                <img className="collaborator-avatar-icon" alt={collaborator.name} src={collaborator.avatar_url} />
              </span>
              <span className="collaborator-name text-truncate" title={collaborator.name} aria-label={collaborator.name}>
                {collaborator.name}
              </span>
            </div>
          </div>
        </div>
      ),
    }));
  }, [collaborators]);

  const getNormalizedOptionValue = useCallback((newValue) => {
    const rawValue = Array.isArray(newValue) ? newValue[0] : newValue;
    return rawValue ? `${rawValue}` : '';
  }, []);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    const newValue = optionEditorContainerRef.current.getValue();
    const normalizedValue = normalizeSelectedValue(newValue);
    onSelectCollaborator({ value: isSupportMultipleSelect ? normalizedValue : getNormalizedOptionValue(newValue) });
    setIsShowEditor(false);
  }, [getNormalizedOptionValue, isSupportMultipleSelect, normalizeSelectedValue, onSelectCollaborator]);

  const handleChange = useCallback((newValue) => {
    const nextValue = normalizeSelectedValue(newValue);
    optionEditorContainerRef.current?.setValue(isSupportMultipleSelect ? nextValue : (nextValue[0] || ''));
    onSelectCollaborator({ value: isSupportMultipleSelect ? nextValue : getNormalizedOptionValue(newValue) });
    if (!isSupportMultipleSelect) {
      setIsShowEditor(false);
    }
  }, [getNormalizedOptionValue, isSupportMultipleSelect, normalizeSelectedValue, onSelectCollaborator]);

  const handleDeselect = useCallback((email) => {
    const nextValue = selectedCollaboratorEmails.filter(item => `${item}` !== `${email}`);
    optionEditorContainerRef.current?.setValue(isSupportMultipleSelect ? nextValue : (nextValue[0] || ''));
    onSelectCollaborator({ value: nextValue });
  }, [isSupportMultipleSelect, onSelectCollaborator, selectedCollaboratorEmails]);

  const handleClearAll = useCallback(() => {
    optionEditorContainerRef.current?.setValue(isSupportMultipleSelect ? [] : '');
    onSelectCollaborator({ value: isSupportMultipleSelect ? [] : '' });
  }, [isSupportMultipleSelect, onSelectCollaborator]);

  const stopEvent = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <div className="seaqa-select custom-select seaqa-customize-select position-relative mr-4 seaqa-collaborator-filter">
      <div className="selected-option" onClick={openEditor} role="button">
        <span className="selected-option-show">
          {selectedCollaboratorEmails.length > 0 ? (
            <div className="selected-option-collaborators">
              {selectedCollaboratorEmails.map((email) => {
                const collaborator = getCollaboratorByEmail(email);
                if (!collaborator) return null;
                return (
                  <div className="collaborator" key={email} title={collaborator.name}>
                    <span className="collaborator-avatar">
                      <img className="collaborator-avatar-icon" alt={collaborator.name} src={collaborator.avatar_url} />
                    </span>
                    <span className="collaborator-name text-truncate" title={collaborator.name} aria-label={collaborator.name}>
                      {collaborator.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : <span style={{ color: '#868E96' }}>{placeholder}</span>}
        </span>
        {!readOnly && (<Icon symbol="arrow-down" />)}
      </div>
      {isShowEditor && (
        <ClickOutside onClickOutside={closeEditor}>
          <div className="sea-metadata-collaborator-selector-popover popover option-editor-popover hide-description p-2">
            <OptionEditorContainer
              ref={optionEditorContainerRef}
              isMultiple={isSupportMultipleSelect}
              placeholder={searchPlaceholder}
              emptyTip={emptyTipText}
              value={isSupportMultipleSelect ? selectedCollaboratorEmails : (selectedCollaboratorEmails[0] || '')}
              options={options}
              onChange={handleChange}
              isShowClearIcon={false}
            >
              {(isSupportMultipleSelect && selectedCollaboratorEmails.length > 0) && (
                <div className="d-flex align-items-center w-100">
                  <div className="d-flex justify-content-start align-items-center gap-1 flex-grow-1 flex-wrap">
                    {selectedCollaboratorEmails.map((email) => {
                      const collaborator = getCollaboratorByEmail(email);
                      if (!collaborator) return null;
                      return (
                        <div className="collaborator" key={email} title={collaborator.name}>
                          <span className="collaborator-avatar">
                            <img className="collaborator-avatar-icon" alt={collaborator.name} src={collaborator.avatar_url} />
                          </span>
                          <span className="collaborator-name text-truncate" title={collaborator.name} aria-label={collaborator.name}>
                            {collaborator.name}
                          </span>
                          <span
                            className="collaborator-remove"
                            onMouseDown={stopEvent}
                            onClick={(e) => {
                              stopEvent(e);
                              handleDeselect(email);
                            }}
                            role="button"
                            aria-label={removeItemText}
                            title={removeItemText}
                          >
                            <Icon symbol="close" />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="seaqa-collaborator-filter-clear-all-wrapper"
                    onMouseDown={stopEvent}
                    onClick={(e) => {
                      stopEvent(e);
                      handleClearAll();
                    }}
                    role="button"
                    aria-label={clearAllText}
                    title={clearAllText}
                  >
                    <Icon symbol="close" className="seaqa-collaborator-filter-clear-all" />
                  </div>
                </div>
              )}
            </OptionEditorContainer>
          </div>
        </ClickOutside>
      )}
    </div>
  );
};

CollaboratorFilter.propTypes = {
  filterTerm: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  filter_predicate: PropTypes.string,
  collaborators: PropTypes.array,
  onSelectCollaborator: PropTypes.func,
  readOnly: PropTypes.bool,
  filterColumn: PropTypes.shape({
    name: PropTypes.string,
  }),
};

export default CollaboratorFilter;
