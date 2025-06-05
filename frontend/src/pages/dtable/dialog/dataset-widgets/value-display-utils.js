
import { getCellValueDisplayString } from 'dtable-utils';

export const getCellDisplayValue = (record, column, collaborators) => {
  const { type, data, key } = column;
  return getCellValueDisplayString(record, type, key, {
    data, collaborators, geolocationHyphen: ' ',
  });
};
