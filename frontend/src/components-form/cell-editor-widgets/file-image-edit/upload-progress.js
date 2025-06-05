import React from 'react';
import PropTypes from 'prop-types';
import { Progress } from 'react-sweet-progress';
import 'react-sweet-progress/lib/style.css';

function UploadProgress(props) {
  return (
    <Progress
      type="circle"
      percent={props.uploadPercent}
      width={props.width || 30}
      theme={
        {
          default: {
            color: props.defaultColor || 'rgba(0, 0, 0, 0.6)',
          },
          active: {
            color: props.activeColor || '#fff',
          },
          success: {
            color: props.successColor || '#fff',
          }
        }
      }
      style={
        {
          color: '#fff',
          fontSize: '12px',
          transform: 'rotate(-90deg)',
          position: 'absolute',
          zIndex: 4
        }
      }
      symbolClassName="file-upload-span"
    />
  );
}

UploadProgress.propTypes = {
  uploadPercent: PropTypes.number.isRequired,
  width: PropTypes.number,
  defaultColor: PropTypes.string,
  activeColor: PropTypes.string,
  successColor: PropTypes.string,
};

export default UploadProgress;
