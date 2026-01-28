module.exports = function (source) {
  const options = this.getOptions ? this.getOptions() : {};

  if (!options.rules || !Array.isArray(options.rules)) {
    return source;
  }
  let result = source;
  const rules = options.rules;

  rules.forEach((rule, index) => {
    try {
      const { search, replace, flags, caseSensitive = true } = rule;
      if (!search || replace === undefined) {
        return;
      }

      let regex;
      if (search instanceof RegExp) {
        regex = search;
      } else if (typeof search === 'string') {
        const regexFlags = flags || (caseSensitive ? 'g' : 'gi');
        regex = new RegExp(search, regexFlags);
      }

      if (!regex) return;
      result = result.replace(regex, replace);

    } catch (error) {
      // nothing todo
    }
  });

  return result;
};
