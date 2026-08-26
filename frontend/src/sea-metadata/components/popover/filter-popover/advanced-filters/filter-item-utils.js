import { FILTER_PREDICATE_SHOW, FILTER_TERM_MODIFIER_SHOW } from '../../../../constants';

class FilterItemUtils {

  static generatorPredicateOption(predicate, isActive) {
    const filterPredicateDisplay = FILTER_PREDICATE_SHOW[predicate] || '';
    const translatedPredicateText = isActive ? filterPredicateDisplay.replace(/\s*\.{3}$/, '') : filterPredicateDisplay;

    return {
      value: predicate,
      label: translatedPredicateText
    };
  }

  static generatorTermModifierOption(filterTermModifier) {
    return {
      value: filterTermModifier,
      label: FILTER_TERM_MODIFIER_SHOW[filterTermModifier]
    };
  }

}

export default FilterItemUtils;
