import PropTypes from 'prop-types';

import './index.css';

const URLFormatter = ({ value }) => {
  if (!value) return null;

  return (
    <a className="sea-qa-url-formatter" href={value} target="_blank" rel="noopener noreferrer">{value}</a>
  );

};

URLFormatter.propTypes = {
  value: PropTypes.string,
};

export default URLFormatter;
