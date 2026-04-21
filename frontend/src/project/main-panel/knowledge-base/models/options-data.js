import { OptionsData, Option as BaseOption } from '@/project/main-panel/tickets/models';

class Option extends BaseOption {
  constructor(object) {
    super(object);
    delete this.tickets_count;
    this.records_count = object.records_count || 0;
  }
}

export default OptionsData;
export {
  Option,
};
