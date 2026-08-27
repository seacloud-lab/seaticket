import React, { useCallback, useRef, useState, useEffect } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Collaborator, AsyncCollaborator, CollaboratorEditor, CustomizeLabel, RemoveButton } from '@/components';
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
  const [isShowEditor, setIsShowEditor] = useState(false);

  const assigneesRef = useRef(null);

  const { collaborators, collaboratorsCache, updateCollaboratorsCache, queryUser } = useCollaborators();

  const deleteCollaborator = useCallback((event, email) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const newValue = value.filter(i => i !== email);
    onChange(newValue);
  }, [value, onChange]);

  const onCollaboratorsChange = useCallback((assignees) => {
    onChange(assignees);
  }, [onChange]);

  const openEditor = useCallback((event) => {
    if (isReadonly) return;
    event.preventDefault();
    event.stopPropagation();
    setIsShowEditor(true);
  }, [isReadonly]);

  const closeEditor = useCallback(() => {
    setIsShowEditor(false);
  }, []);

  const onHotKey = useCallback((event) => {
    if (isInputOrEditorActive() || isActiveOtherPopover('assignees-editor-popover')) return;
    if (isA(event)) {
      openEditor(event);
    } else if (isEsc(event)) {
      closeEditor();
    }
  }, [openEditor, closeEditor]);

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
          onClick={openEditor}
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
                  <RemoveButton callback={(event) => deleteCollaborator(event, assignee)}/>
                )}
              </CollaboratorComponent>
            );
          }) : (<div className="seaqa-tip-default">{tip}</div>)}
        </div>
      </div>
      {!isReadonly && isShowEditor && (
        <CollaboratorEditor
          id={id}
          isCloseSubmit={true}
          sameWidthWithTarget={240}
          target={assigneesRef}
          value={value}
          className="seaqa-settings-popover"
          placeholder={gettext('Search users')}
          emptyTip={gettext('No users available')}
          collaborators={collaborators}
          onChange={onCollaboratorsChange}
          onClose={closeEditor}
        />
      )}
    </>
  );
};

export default CollaboratorsSettings;
