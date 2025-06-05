import React from 'react';
import PropTypes from 'prop-types';
import { gettext } from '../../utils/constants';

const propTypes = {
  currentPage: PropTypes.number,
  hasNextPage: PropTypes.bool,
  currentPerPage: PropTypes.number,
  goToPreviousPage: PropTypes.func,
  goToNextPage: PropTypes.func,
  changePerPage: PropTypes.func,
};

const OrgPaginator = ({ currentPage, hasNextPage, currentPerPage, goToPreviousPage, goToNextPage, changePerPage }) => {

  const disableLeftButton = currentPage === 1;
  const disableRightButton = !hasNextPage;

  const perPageText = (perPage) => {
    return gettext('{number_placeholder} / Page').replace('{number_placeholder}', perPage);
  };

  return (
    <div className="org-paginator-container d-flex justify-content-center align-items-center my-6">
      <button className="btn btn-secondary" disabled={disableLeftButton} onClick={goToPreviousPage}>
        <span className={`dtable-font dtable-icon-left ${disableLeftButton ? 'paginator-disabled-btn' : ''}`}></span>
      </button>
      <span className="btn btn-primary mx-4">{currentPage}</span>
      <button className="btn btn-secondary" disabled={disableRightButton} onClick={goToNextPage}>
        <span className={`dtable-font dtable-icon-right ${disableRightButton ? 'paginator-disabled-btn' : ''}`}></span>
      </button>
      <select
        className="form-control d-inline-block w-auto ml-6"
        value={currentPerPage}
        onChange={(e) => changePerPage(e)}
      >
        <option value="25">{perPageText(25)}</option>
        <option value="50">{perPageText(50)}</option>
        <option value="100">{perPageText(100)}</option>
      </select>
    </div>
  );
};

OrgPaginator.propTypes = propTypes;

export default OrgPaginator;
