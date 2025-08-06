import PropTypes from 'prop-types';

const TextFormatter = ({ value }) => {
  if (!value) return null;
  return (<>{value}</>);
};

TextFormatter.propTypes = {
  value: PropTypes.string,
};

export default TextFormatter;
