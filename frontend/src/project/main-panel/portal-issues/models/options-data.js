import { OptionsData, Option as BaseOption } from '@/project/main-panel/tickets/models';

class Option extends BaseOption {
  constructor(object) {
    super(object);
    delete this.tickets_count;
    this.issues_count = object.issues_count || 0;
  }
}

export default OptionsData;
export {
  Option,
};
