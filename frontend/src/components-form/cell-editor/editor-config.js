import React from 'react';
import { CellType } from 'dtable-utils';
import CollaboratorEditor from './collaborator-editor';
import SingleSelectEditor from './single-select-editor';
import MultipleSelectEditor from './multiple-select-editor';
import LongTextEditor from './long-text-editor';
import DateEditor from './date-editor';
import TextEditor from './text-editor';
import NumberEditor from './number-editor';
import FileEditor from './file-editor';
import ImageEditor from './image-editor';
import GeolocationEditor from './geolocation-editor';
import UrlEditor from './url-editor';
import EmailEditor from './email-editor';
import DurationEditor from './duration-editor';
import LinkEditor from './link-editor';
// Rating editor and formatter is together
import RatingFormatter from '../cell-formatter/rating-formatter';
import DigitalSignEditor from './digital-sign-editor';
import CheckboxEditor from './checkbox-editor/index';

import '../cell-css/common-editor.css';

const EditorConfig = {
  [CellType.COLLABORATOR]: <CollaboratorEditor />,
  [CellType.SINGLE_SELECT]: <SingleSelectEditor />,
  [CellType.MULTIPLE_SELECT]: <MultipleSelectEditor />,
  [CellType.LONG_TEXT]: <LongTextEditor />,
  [CellType.DATE]: <DateEditor />,
  [CellType.TEXT]: <TextEditor />,
  [CellType.NUMBER]: <NumberEditor />,
  [CellType.CHECKBOX]: <CheckboxEditor />,
  [CellType.FILE]: <FileEditor />,
  [CellType.IMAGE]: <ImageEditor />,
  [CellType.GEOLOCATION]: <GeolocationEditor />,
  [CellType.URL]: <UrlEditor />,
  [CellType.EMAIL]: <EmailEditor />,
  [CellType.DURATION]: <DurationEditor />,
  [CellType.LINK]: <LinkEditor />,
  [CellType.RATE]: <RatingFormatter/>,
  [CellType.DIGITAL_SIGN]: <DigitalSignEditor/>
};

export default EditorConfig;
