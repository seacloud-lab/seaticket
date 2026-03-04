import React, { forwardRef, useImperativeHandle, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { gettext } from '@constants';
import Main from '@/components/collaborator-editor/main';
import { useCollaborators } from '../../../hooks';

import './index.css';

const CollaboratorEditor = forwardRef(({
  height,
  column,
  value,
  editorPosition = { left: 0, top: 0 },
  onCommit,
  onPressTab,
  onClose,
}, ref) => {
  const editorRef = useRef(null);
  const mainRef = useRef(null);

  const { collaborators } = useCollaborators();

  const blur = useCallback(() => {
    onCommit && onCommit();
  }, [onCommit]);

  useEffect(() => {
    if (editorRef.current) {
      const { bottom } = editorRef.current.getBoundingClientRect();
      if (bottom > window.innerHeight) {
        editorRef.current.style.top = 'unset';
        editorRef.current.style.bottom = editorPosition.top + height - window.innerHeight + 'px';
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => {
      const { key } = column;
      const value = mainRef.current.getValue();
      return { [key]: value };
    },
    onBlur: () => blur(),
    onClose: () => onClose(),
  }), [column, blur, onClose]);

  const isBeyondScreen = editorPosition.right > window.innerWidth;

  return (
    <div
      className="sea-metadata-collaborator-editor collaborator-editor-popover"
      style={{ top: -38, left: isBeyondScreen ? 'unset' : 0, right: isBeyondScreen ? -column.width : 'unset' }}
      ref={editorRef}
    >
      <Main
        ref={mainRef}
        isShowDeleteArea={true}
        placeholder={gettext('Search users')}
        value={value}
        collaborators={collaborators}
        onPressTab={onPressTab}
      />
    </div>
  );
});

CollaboratorEditor.propTypes = {
  saveImmediately: PropTypes.bool,
  height: PropTypes.number,
  column: PropTypes.object,
  value: PropTypes.array,
  editorPosition: PropTypes.object,
  onCommit: PropTypes.func,
  onClose: PropTypes.func,
  onPressTab: PropTypes.func,
};

export default CollaboratorEditor;
