import React, { useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import toaster from '../toaster';
import { gettext } from '../../constants';

const UploadFile = forwardRef(({ fileType, onUpload }, ref) => {
  const inputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.addEventListener('load', () => {
      return new Promise((resolve, reject) => {
        resolve(file);
      }).then((file) => {
        inputRef.current.value = '';
        const base64 = reader.result;
        onUpload(file, base64);
        return;
      }).catch(error => {
        toaster.warning(gettext('File upload failed'));
        inputRef.current.value = '';
      });
    }, false);
    reader.addEventListener('error', () => {
      toaster.warning(gettext('File loading failed'));
    }, false);
  }, [onUpload]);

  const onChange = useCallback((event) => {
    event.persist();
    const file = event.target.files[0];
    handleFile(file);
  }, [handleFile]);

  const onClick = useCallback((event) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  }, []);

  useImperativeHandle(ref, () => ({

    uploadFile: (file) => {
      const validFile = Array.isArray(file) ? file[0] : file;
      handleFile(validFile);
    },

    onClick: () => {
      inputRef.current.click();
    },

  }), [handleFile, inputRef]);

  return (
    <input type="file" ref={inputRef} accept={fileType || 'file/*'} className="d-none" onChange={onChange} onClick={onClick}/>
  );
});

UploadFile.propTypes = {
  fileType: PropTypes.string,
  onUpload: PropTypes.func.isRequired,
};

export default UploadFile;
