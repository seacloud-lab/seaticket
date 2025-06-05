import React from 'react';
import { CellType } from 'dtable-utils';
import TextFormatter from './text-formatter';
import NumberFormatter from './number-formatter';
import DateFormatter from './date-formatter';
import SingleSelectFormatter from './single-select-formatter';
import MultipleSelectFormatter from './multiple-select-formatter';
import CollaboratorFormatter from './collaborator-formatter';
import CheckboxFormatter from './checkbox-formatter';
import FileFormatter from './file-formatter';
import ImageFormatter from './image-formatter';
import LongTextFormatter from './long-text-formatter';
import RatingFormatter from './rating-formatter';

import '../cell-css/formatter.css';

const FormatterConfig = {
  [CellType.TEXT]: <TextFormatter />,
  [CellType.NUMBER]: <NumberFormatter />,
  [CellType.DATE]: <DateFormatter />,
  [CellType.CHECKBOX]: <CheckboxFormatter />,
  [CellType.SINGLE_SELECT]: <SingleSelectFormatter />,
  [CellType.MULTIPLE_SELECT]: <MultipleSelectFormatter />,
  [CellType.COLLABORATOR]: <CollaboratorFormatter />,
  [CellType.FILE]: <FileFormatter />,
  [CellType.IMAGE]: <ImageFormatter />,
  [CellType.LONG_TEXT]: <LongTextFormatter />,
  [CellType.RATE]: <RatingFormatter />
};

export default FormatterConfig;
