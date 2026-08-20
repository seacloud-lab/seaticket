import React, { useMemo } from 'react';
import OptionsEditorContainer from '../options-editor/sync-options-editor/container';
import Collaborator from '../collaborator/collaborator';

const RemoveBtn = Collaborator.RemoveBtn;

const Container = ({
  innerRef,
  isShowDeleteArea,
  id,
  isAsyncSearch = false,
  isMultiple,
  isSearchEnabled,
  placeholder,
  emptyTip,
  value,
  collaborators,
  onChange,
  onToggle,
}) => {
  const options = useMemo(() => {
    if (!Array.isArray(collaborators) || collaborators.length === 0) return [];
    return collaborators.map(collaborator => {
      return {
        value: collaborator.email,
        name: collaborator.name,
        label: (<Collaborator collaborator={collaborator} className="mr-0" />)
      };
    });
  }, [collaborators]);

  return (
    <OptionsEditorContainer
      id={id}
      ref={innerRef}
      isMultiple={isMultiple}
      placeholder={placeholder}
      isAsyncSearch={isAsyncSearch}
      isSearchEnabled={isSearchEnabled}
      checkPlacement="right"
      emptyTip={emptyTip}
      value={value}
      options={options}
      optionHeight={32}
      onChange={onChange}
      onToggle={onToggle}
    >
      {isShowDeleteArea ? ({ value, onChange }) => {
        if (value.length === 0) return null;
        return value.map(item => {
          const collaborator = collaborators.find(c => c.email === item);
          if (!collaborator) return null;
          return (
            <Collaborator key={item} collaborator={collaborator} className="mr-0">
              <RemoveBtn callback={() => onChange(item)} />
            </Collaborator>
          );
        });
      } : null}
    </OptionsEditorContainer>
  );
};

export default Container;
