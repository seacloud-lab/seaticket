import PropTypes from 'prop-types';

const TextFormatter = ({ value }) => {
  if (!value) return null;
  return (<>{value}</>);
};

TextFormatter.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
};

export default TextFormatter;
