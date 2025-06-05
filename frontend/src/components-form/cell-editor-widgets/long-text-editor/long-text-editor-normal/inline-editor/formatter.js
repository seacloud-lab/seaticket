import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { LongTextEditorDialog } from '@seafile/seafile-editor';
import LongTextEditorPreviewAll from '../../../long-text-editor-preview-all';

const Formatter = ({ value, isSupportPreview, onClick, headerName, column }) => {
  const [isShowReadonlyDialog, setShowReadonlyDialog] = useState(false);

  const onContentClick = useCallback(() => {
    if (!isSupportPreview) return;
    setShowReadonlyDialog(true);
    onClick && onClick();
  }, [isSupportPreview, onClick]);

  return (
    <>
      <LongTextEditorPreviewAll
        newValue={value}
        className={isSupportPreview ? '' : 'not-allowed-click'}
        onContentClick={onContentClick}
      />
      {isShowReadonlyDialog && (
        <LongTextEditorDialog
          readOnly={true}
          headerName={headerName || column?.name}
          value={value.text}
          onCloseEditorDialog={() => setShowReadonlyDialog(false)}
        />
      )}
    </>
  );

};

Formatter.propTypes = {
  isSupportPreview: PropTypes.bool,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  headerName: PropTypes.string,
  onClick: PropTypes.func,
};

export default Formatter;
