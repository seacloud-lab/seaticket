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

const CollaboratorFilter = ({ readOnly, filterTerm, collaborators, placeholder, filter_predicate, onSelectCollaborator }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const optionEditorContainerRef = useRef(null);

  const isSupportMultipleSelect = useMemo(() => SUPPORT_MULTIPLE_SELECT_OPTIONS.includes(filter_predicate), [filter_predicate]);

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
  }, [collaborators, selectedCollaboratorEmails]);

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
          ) : placeholder}
        </span>
        {!readOnly && (<Icon symbol="arrow-down" />)}
      </div>
      {isShowEditor && (
        <ClickOutside onClickOutside={closeEditor}>
          <div className="sea-metadata-collaborator-selector-popover popover seaqa-collaborator-selector-popover option-editor-popover sea-metadata-basic-filter-collaborator-selector hide-description seaqa-collaborator-filter-popover p-2">
            <OptionEditorContainer
              ref={optionEditorContainerRef}
              isMultiple={isSupportMultipleSelect}
              placeholder={gettext('Search collaborator')}
              emptyTip={gettext('No collaborators')}
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
                            aria-label={gettext('Remove collaborator')}
                            title={gettext('Remove collaborator')}
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
                    aria-label={gettext('Clear all collaborators')}
                    title={gettext('Clear all collaborators')}
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
  placeholder: PropTypes.string,
};

export default CollaboratorFilter;
