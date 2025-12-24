import React, { useState, useCallback } from 'react';
import { EmbeddingView as AtlasEmbeddingView } from 'embedding-atlas/react';

const EmbeddingView = ({
  embeddingData,
  categoryData,
  metadata,
  useCategory,
  displayMode,
  width,
  height
}) => {
  const [tooltip, setTooltip] = useState(null);

  const querySelection = useCallback(async (x, y, unitDistance) => {
    if (!embeddingData || !metadata || !metadata.records) {
      return null;
    }

    let minDistance2 = null;
    let minIndex = null;

    for (let i = 0; i < embeddingData.x.length; i++) {
      const dx = embeddingData.x[i] - x;
      const dy = embeddingData.y[i] - y;
      const d2 = dx * dx + dy * dy;

      if (minDistance2 == null || d2 < minDistance2) {
        minDistance2 = d2;
        minIndex = i;
      }
    }

    if (minIndex == null || minDistance2 == null || Math.sqrt(minDistance2) > unitDistance * 10) {
      return null;
    }

    const record = metadata.records[minIndex];
    return {
      x: embeddingData.x[minIndex],
      y: embeddingData.y[minIndex],
      text: record.ai_summary,
      fields: record
    };
  }, [embeddingData, metadata]);

  return (
    <AtlasEmbeddingView
      data={{
        x: embeddingData.x,
        y: embeddingData.y,
        category: useCategory ? (categoryData?.categories || null) : null
      }}
      categoryColors={useCategory ? (categoryData?.colors || null) : null}
      tooltip={tooltip}
      onTooltip={setTooltip}
      querySelection={querySelection}
      labels={[]}
      width={width}
      height={height}
      config={{
        colorScheme: 'light',
        mode: displayMode,
        minimumDensity: displayMode === 'density' ? 0.001 : null,
        pointSize: 4,
      }}
    />
  );
};

export default EmbeddingView;
