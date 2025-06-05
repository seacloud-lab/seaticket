import React from 'react';
import PropTypes from 'prop-types';
import { CellType } from 'dtable-utils';
import { STATIC_CELL_TYPE } from '../../constants';
import { getFileThumbnailUrl } from '../../utils/file-url-utils';

const propTypes = {
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  style: PropTypes.object,
  type: PropTypes.string,
};

function FileWidget(props) {
  const { value, style, type } = props;
  if (!value) return null;
  if (type === CellType.IMAGE || type === STATIC_CELL_TYPE.STATIC_IMAGE || type === CellType.DIGITAL_SIGN) {
    return <img key={value} src={value} alt={'attachment'} style={style} />;
  }
  const fileThumbnailUrl = getFileThumbnailUrl(value);
  return <img key={value.url} src={fileThumbnailUrl} alt={'attachment'} style={style} />;
}

FileWidget.propTypes = propTypes;

export default FileWidget;
