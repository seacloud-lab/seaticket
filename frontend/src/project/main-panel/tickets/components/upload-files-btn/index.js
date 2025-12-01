import { forwardRef, useCallback, useRef } from 'react';
import classnames from 'classnames';
import { gettext } from '@/constants';
import { Icon } from '@/components';

import './index.css';

const UploadFilesButton = forwardRef(({ className, onChange }, ref) => {

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
    <div className={classnames('sea-qa-ticket-upload-files-btn sea-qa-icon-btn', className)} onClick={onUploadBtnClick}>
      <Icon symbol="paperclip" className="mr-2" />
      {gettext('Paste, drop, or click to add files')}
      <input type="file" className="d-none" ref={uploadInputRef} onClick={onInputFile} onChange={uploadFilesChange} value="" multiple />
    </div>
  );
});

export default UploadFilesButton;
