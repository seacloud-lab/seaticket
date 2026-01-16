import React, { useState, useCallback, useMemo } from 'react';
import { EmbeddingViewMosaic } from 'embedding-atlas/react';

const EmbeddingView = ({
  coordinator, // Mosaic coordinator
  table,
  xColumn,
  yColumn,
  categoryColumn,
  categoryColors,
  identifierColumn,
  availableColumns,
  filter, // Mosaic Selection for filtering
  displayMode,
  width,
  height,
  onPointClick,
}) => {
  const [tooltip, setTooltip] = useState(null);
  const [selection, setSelection] = useState([]);

  const handleSelection = useCallback((newSelection) => {
    if (newSelection && newSelection.length > 0 && onPointClick) {
      const point = newSelection[0];
      if (point?.fields) {
        onPointClick(point.fields);
      }
      setTimeout(() => setSelection([]), 0);
    } else {
      setSelection(newSelection);
    }
  }, [onPointClick]);

  // config
  const config = useMemo(() => ({
    colorScheme: 'light',
    mode: displayMode,
    minimumDensity: displayMode === 'density' ? 0.001 : null,
    pointSize: 4,
  }), [displayMode]);

  const additionalFields = useMemo(() => {
    if (!availableColumns || availableColumns.length === 0) return null;

    const neededFields = ['ai_summary', '_pk', 'title', 'connection_id', 'connection_type', 'path', 'filename', 'url', 'slug', 'topic_id', 'state'];
    const fields = {};

    neededFields.forEach(col => {
      if (availableColumns.includes(col)) {
        fields[col] = col;
      }
    });

    return Object.keys(fields).length > 0 ? fields : null;
  }, [availableColumns]);

  const textColumn = availableColumns?.includes('ai_summary') ? 'ai_summary' : null;

  return (
    <EmbeddingViewMosaic
      coordinator={coordinator}
      table={table}
      x={xColumn}
      y={yColumn}
      category={categoryColumn}
      categoryColors={categoryColors}
      identifier={identifierColumn}
      text={textColumn}
      additionalFields={additionalFields}
      filter={filter}
      tooltip={tooltip}
      onTooltip={setTooltip}
      selection={selection}
      onSelection={handleSelection}
      labels={[]}
      width={width}
      height={height}
      config={config}
    />
  );
};

export default EmbeddingView;
