import { CellType, FORMULA_RESULT_TYPE } from 'dtable-utils';
import { STATIC_CELL_TYPE, LINK_TABLE, DYNAMIC_CELL_TYPE, VIEW_TYPE, PAGE_HEADER_FOOTER_TYPE } from '../constants';
import StaticText from './static/static-text';
import StaticImage from './static/static-image';
import CurrentDate from './dynamic/current-date';
import TemplateName from './dynamic/template-name';
import CurrentUser from './dynamic/current-user';
import PageNumber from './dynamic/page-number';
import ViewAllRecordsTable from './view/all-records-table';
import ViewName from './view/view-name';
import PageHeader from './page-header';
import PageFooter from './page-footer';
import Text from './dtable/text';
import _Date from './dtable/_date';
import _Duration from './dtable/_duration';
import _File from './dtable/_file';
import _Image from './dtable/_image';
import _Link from './dtable/_link';
import _Number from './dtable/_number';
import _Url from './dtable/_url';
import Checkbox from './dtable/checkbox';
import Email from './dtable/email';
import SingleSelect from './dtable/single-select';
import MultipleSelect from './dtable/multiple-select';
import LongText from './dtable/long-text';
import CreateTime from './dtable/create-time';
import LastModifyTime from './dtable/last-modify-time';
import Collaborator from './dtable/collaborator';
import LastModifier from './dtable/last-modifier';
import Creator from './dtable/creator';
import Geolocation from './dtable/geolocation';
import Rate from './dtable/rate';
import Button from './dtable/button';
import _LinkTable from './dtable/_linkTable';
import DigitalSign from './dtable/digital-sign';

const generatorModel = (model, type, { data, optionColors } = {}) => {
  switch (type) {
    case STATIC_CELL_TYPE.STATIC_TEXT: {
      return new StaticText(model);
    }
    case STATIC_CELL_TYPE.STATIC_IMAGE: {
      return new StaticImage(model);
    }
    case DYNAMIC_CELL_TYPE.CURRENT_DATE: {
      return new CurrentDate(model);
    }
    case DYNAMIC_CELL_TYPE.TEMPLATE_NAME: {
      return new TemplateName(model);
    }
    case DYNAMIC_CELL_TYPE.CURRENT_USER: {
      return new CurrentUser(model);
    }
    case DYNAMIC_CELL_TYPE.PAGE_NUMBER: {
      return new PageNumber(model);
    }
    case VIEW_TYPE.ALL_RECORDS_TABLE: {
      return new ViewAllRecordsTable(model);
    }
    case VIEW_TYPE.VIEW_NAME: {
      return new ViewName(model);
    }
    case PAGE_HEADER_FOOTER_TYPE.PAGE_HEADER: {
      return new PageHeader(model);
    }
    case PAGE_HEADER_FOOTER_TYPE.PAGE_FOOTER: {
      return new PageFooter(model);
    }
    case CellType.TEXT: {
      return new Text(model);
    }
    case CellType.CHECKBOX: {
      return new Checkbox(model);
    }
    case CellType.DATE: {
      return new _Date(model);
    }
    case CellType.DURATION: {
      return new _Duration(model);
    }
    case CellType.FILE: {
      return new _File(model);
    }
    case CellType.IMAGE: {
      return new _Image(model);
    }
    case CellType.LINK: {
      return new _Link(model);
    }
    case LINK_TABLE: {
      return new _LinkTable(model);
    }
    case CellType.NUMBER: {
      return new _Number(model);
    }
    case CellType.URL: {
      return new _Url(model);
    }
    case CellType.EMAIL: {
      return new Email(model);
    }
    case CellType.SINGLE_SELECT: {
      return new SingleSelect(model);
    }
    case CellType.MULTIPLE_SELECT: {
      return new MultipleSelect(model);
    }
    case CellType.LONG_TEXT: {
      return new LongText(model);
    }
    case CellType.COLLABORATOR: {
      return new Collaborator(model);
    }
    case CellType.LAST_MODIFIER: {
      return new LastModifier(model);
    }
    case CellType.CREATOR: {
      return new Creator(model);
    }
    case CellType.CTIME: {
      return new CreateTime(model);
    }
    case CellType.MTIME: {
      return new LastModifyTime(model);
    }
    case CellType.FORMULA:
    case CellType.LINK_FORMULA: {
      const { result_type } = data || {};
      switch (result_type) {
        case FORMULA_RESULT_TYPE.NUMBER: {
          return new _Number({ ...model, type: CellType.NUMBER });
        }
        case FORMULA_RESULT_TYPE.DATE: {
          return new _Date({ ...model, type: CellType.DATE });
        }
        case FORMULA_RESULT_TYPE.ARRAY: {
          const { array_type } = data || {};
          if (!array_type) return new Text({ ...model, type: CellType.TEXT }, CellType.TEXT);
          switch (array_type) {
            case CellType.FILE:
            case CellType.IMAGE:
            case CellType.MULTIPLE_SELECT:
            case CellType.COLLABORATOR: {
              return generatorModel({ ...model, type: array_type }, array_type);
            }
            case CellType.SINGLE_SELECT: {
              return generatorModel({ ...model, type: CellType.MULTIPLE_SELECT }, CellType.MULTIPLE_SELECT);
            }
            case CellType.CREATOR:
            case CellType.LAST_MODIFIER: {
              return generatorModel({ ...model, type: CellType.COLLABORATOR }, CellType.COLLABORATOR);
            }
            case CellType.LINK: {
              return generatorModel({ ...model, type: CellType.LINK }, CellType.LINK);
            }
            case CellType.LONG_TEXT: {
              return generatorModel({ ...model, type: CellType.LONG_TEXT }, CellType.LONG_TEXT);
            }
            case CellType.DIGITAL_SIGN: {
              return generatorModel({ ...model, type: CellType.IMAGE }, CellType.IMAGE);
            }
            default: {
              return new Text({ ...model, type: CellType.TEXT }, CellType.TEXT);
            }
          }
        }
        default: {
          return new Text({ ...model, type: CellType.TEXT }, CellType.TEXT);
        }
      }
    }
    case CellType.GEOLOCATION: {
      return new Geolocation(model);
    }
    case CellType.RATE: {
      return new Rate(model);
    }
    case CellType.BUTTON: {
      return new Button({ ...model, column_data: data, optionColors: optionColors });
    }
    case CellType.DIGITAL_SIGN: {
      return new DigitalSign(model);
    }
    default: {
      return new Text(model);
    }
  }
};

export default generatorModel;
