import React from 'react';
import { CellType } from 'dtable-utils';
import { FormulaFormatter, AutoNumberFormatter } from 'dtable-ui-component';
import CollaboratorEditor from './collaborator-editor';
import SingleSelectEditor from '../../../components-form/cell-editor/single-select-editor';
import MultipleSelectEditor from '../../../components-form/cell-editor/multiple-select-editor';
import LongTextEditor from './long-text-editor';
import FileEditor from './file-editor';
import ImageEditor from './image-editor';
import GeolocationEditor from './geolocation-editor';
import CheckboxEditor from './checkbox-editor/checkbox-editor';
import DateEditor from '../../../components-form/cell-editor/date-editor';
import TextEditor from '../../../components-form/cell-editor/text-editor';
import NumberEditor from '../../../components-form/cell-editor/number-editor';
import UrlEditor from '../../../components-form/cell-editor/url-editor';
import EmailEditor from '../../../components-form/cell-editor/email-editor';
import DurationEditor from '../../../components-form/cell-editor/duration-editor';
import LinkEditor from './widgets/link-editor';
import DigitalSignEditor from '../../../components-form/cell-editor/digital-sign-editor';

// Rating editor and formatter is together
import RatingFormatter from '../../../components-form/cell-formatter/rating-formatter';

import '../../../components-form/cell-css/common-editor.css';

const editorMap = {
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
  [CellType.RATE]: <RatingFormatter />,
  [CellType.LINK]: <LinkEditor />,
  [CellType.DEFAULT]: <TextEditor />,
  [CellType.DIGITAL_SIGN]: <DigitalSignEditor />,
  [CellType.FORMULA]: <FormulaFormatter />,
  [CellType.AUTO_NUMBER]: <AutoNumberFormatter />,
};

export default editorMap;
