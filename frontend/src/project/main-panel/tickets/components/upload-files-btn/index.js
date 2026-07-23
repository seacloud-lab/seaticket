import { forwardRef, useCallback, useRef } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon } from '@/components';

import './index.css';

const UploadFilesButton = forwardRef(({ className, onChange, isShowText = true }, ref) => {

  const uploadInputRef = useRef(null);

  const onInputFile = useCallback((event) => {
    event.nativeEvent.stopImmediatePropagation();
    event.stopPropagation();
  }, []);

  const uploadFilesChange = useCallback((event) => {
    onChange(event.target.files);
  }, [onChange]);

  const onUploadBtnClick = useCallback(() => {
    uploadInputRef.current.click();
  }, []);

  return (
    <div
      className={classnames('seaqa-ticket-upload-files-btn seaqa-icon-btn', className)}
      title={gettext('Paste, drop, or click to add files')}
      aria-label={gettext('Paste, drop, or click to add files')}
      onClick={onUploadBtnClick}
    >
      <Icon symbol="paperclip" className={classnames({ 'mr-2': isShowText })} />
      {isShowText && gettext('Paste, drop, or click to add files')}
      <input type="file" className="d-none" ref={uploadInputRef} onClick={onInputFile} onChange={uploadFilesChange} value="" multiple />
    </div>
  );
});

export default UploadFilesButton;
