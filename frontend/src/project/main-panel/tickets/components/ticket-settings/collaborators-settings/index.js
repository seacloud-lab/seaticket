import React, { useCallback, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Collaborator, AsyncCollaborator, CollaboratorEditor, CustomizeLabel } from '@/components';
import { isInputOrEditorActive, isActiveOtherPopover } from '@/utils/dom';
import { isEsc, isA } from '@/utils/hotkey';

import './index.css';

const CollaboratorsSettings = ({
  id,
  isReadonly,
  value,
  className = 'mb-4',
  title = gettext('Collaborators'),
  tip = gettext('No collaborators'),
  useCollaborators,
  onChange,
}) => {
  const [isShowAssigneesEditor, setIsShowAssigneesEditor] = useState(false);

  const assigneesRef = useRef(null);

  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();

  const deleteAssignee = useCallback((event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const newValue = value.filter(i => i !== email);
    onChange(newValue);
  }, [value, onChange]);

  const onAssigneesChange = useCallback((assignees) => {
    onChange(assignees);
    setIsShowAssigneesEditor(false);
  }, [onChange]);

  const openAssigneesEditor = useCallback((event) => {
    if (isReadonly) return;
    event.preventDefault();
    event.stopPropagation();
    setIsShowAssigneesEditor(true);
  }, [isReadonly]);

  const closeAssigneesEditor = useCallback(() => {
    setIsShowAssigneesEditor(false);
  }, []);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('assignees-editor-popover')) return;
    if (isA(event)) {
      openAssigneesEditor(event);
    } else if (isEsc(event)) {
      closeAssigneesEditor();
    }
  }, [openAssigneesEditor, closeAssigneesEditor]);

  useEffect(() => {
    document.addEventListener('keydown', onHotKey);
    return () => {
      document.removeEventListener('keydown', onHotKey);
    };
  }, [onHotKey]);

  const CollaboratorComponent = queryUser ? AsyncCollaborator : Collaborator;
  const CollaboratorComponentProps = queryUser ? {
    collaborators,
    collaboratorsCache,
    updateCollaboratorsCache,
    api: queryUser,
  } : {
  };

  return (
    <>
      <div className={classnames('seaqa-settings-item', className)}>
        <CustomizeLabel icon="group">
          {title}
        </CustomizeLabel>
        <div
          className={classnames('collaborators-formatter', { 'valid': value.length > 0 })}
          onClick={openAssigneesEditor}
          ref={assigneesRef}
        >
          {value.length > 0 ? value.map(assignee => {
            if (!assignee) return null;
            const email = typeof assignee === 'string' ? assignee : assignee.email;
            const collaborator = collaborators.find(c => c.email === email);
            if (!queryUser && !collaborator) return null;
            return (
              <CollaboratorComponent key={email} value={email} collaborator={collaborator} { ...CollaboratorComponentProps }>
                {!isReadonly && (
                  <Collaborator.RemoveBtn callback={(event) => deleteAssignee(event, assignee)}/>
                )}
              </CollaboratorComponent>
            );
          }) : (<div className="seaqa-tip-default">{tip}</div>)}
        </div>
      </div>
      {!isReadonly && isShowAssigneesEditor && (
        <CollaboratorEditor
          id={id}
          sameWidthWithTarget={240}
          target={assigneesRef}
          value={value}
          className="seaqa-settings-popover"
          placeholder={gettext('Search users')}
          emptyTip={gettext('No users available')}
          collaborators={collaborators}
          onChange={onAssigneesChange}
          onClose={closeAssigneesEditor}
        />
      )}
    </>
  );
};

export default CollaboratorsSettings;
