import React, { useMemo } from 'react';
import OptionsEditorContainer from '../options-editor/static-options-editor/container';
import Collaborator from '../collaborator/collaborator';
import RemoveButton from '../remove-btn';

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
  ...props
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
      { ...props }
    >
      {isShowDeleteArea && Array.isArray(value) ? ({ value, onChange }) => {
        if (value.length === 0) return null;
        return value.map(item => {
          const collaborator = collaborators.find(c => c.email === item);
          if (!collaborator) return null;
          return (
            <Collaborator key={item} collaborator={collaborator} className="mr-0">
              <RemoveButton callback={() => onChange(item)} />
            </Collaborator>
          );
        });
      } : null}
    </OptionsEditorContainer>
  );
};

export default Container;
