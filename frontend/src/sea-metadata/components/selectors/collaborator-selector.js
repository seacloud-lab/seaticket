import React, { useCallback, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { CollaboratorEditor, Collaborator } from '@/components';
import { gettext } from '@/constants';
import SelectTrigger from '@/components/customize-select/select-trigger';
import { isFilterTermArray } from '@/sea-metadata/utils/filter';

const COLLABORATOR_SELECTOR_TEXT_MAP = {
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

const getCollaboratorSelectorText = (filterColumnName, key) => {
  const textMap = COLLABORATOR_SELECTOR_TEXT_MAP[filterColumnName] || COLLABORATOR_SELECTOR_TEXT_MAP.default;
  return textMap[key];
};

const CollaboratorSelector = ({ readOnly, value, collaborators, predicate, onChange, column }) => {
  const [isShowEditor, setIsShowEditor] = useState(false);
  const collaboratorSelectorRef = useRef(null);

  const isMultiple = useMemo(() => isFilterTermArray(column, predicate), [column, predicate]);
  const placeholder = useMemo(() => {
    const columnName = column?.name;
    return getCollaboratorSelectorText(columnName, 'placeholder');
  }, [column]);

  const selectedCollaboratorEmails = useMemo(() => {
    if (isMultiple) {
      return Array.isArray(value) ? value.map(item => `${item}`).filter(Boolean) : [];
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? [`${value[0]}`] : [];
    }
    return value ? [`${value}`] : [];
  }, [value, isMultiple]);

  const getCollaboratorByEmail = useCallback((email) => collaborators.find(c => c.email === email), [collaborators]);

  const openEditor = useCallback(() => {
    if (readOnly) return;
    setIsShowEditor(true);
  }, [readOnly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  return (
    <>
      <SelectTrigger
        innerRef={collaboratorSelectorRef}
        disabled={readOnly}
        focus={isShowEditor}
        selectedValue={(
          <>
            {selectedCollaboratorEmails.length > 0 ? (
              <span className="selected-option-show">
                {selectedCollaboratorEmails.map((email) => {
                  const collaborator = getCollaboratorByEmail(email);
                  if (!collaborator) return null;
                  return (<Collaborator key={email} collaborator={collaborator} className="mr-0" />);
                })}
              </span>
            ) : (
              <span className="select-placeholder">{placeholder}</span>
            )}
          </>
        )}
        onClick={openEditor}
      />
      {isShowEditor && (
        <CollaboratorEditor
          sameWidthWithTarget={300}
          target={collaboratorSelectorRef}
          value={value}
          className="sea-metadata-data-filter-popover"
          placeholder={gettext('Search users')}
          emptyTip={gettext('No users available')}
          collaborators={collaborators}
          isMultiple={isMultiple}
          onChange={onChange}
          onClose={closeEditor}
        />
      )}
    </>
  );
};

CollaboratorSelector.propTypes = {
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string]),
  predicate: PropTypes.string,
  collaborators: PropTypes.array,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool,
  column: PropTypes.shape({
    name: PropTypes.string,
    type: PropTypes.string,
  }),
};

export default CollaboratorSelector;
