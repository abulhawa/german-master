import { useEffect, useState } from 'react';
import { z } from 'zod';

export interface FeatureCapabilities {
  writingLab: boolean;
}

export const DEFAULT_FEATURE_CAPABILITIES: FeatureCapabilities = {
  writingLab: false,
};

const featureCapabilitiesSchema = z.object({
  features: z.object({
    writingLab: z.boolean().default(false),
  }),
});

export async function fetchFeatureCapabilities(): Promise<FeatureCapabilities> {
  const response = await fetch('/api/features', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load feature capabilities (${response.status})`);
  }

  const payload = await response.json().catch(() => ({ features: DEFAULT_FEATURE_CAPABILITIES }));
  return featureCapabilitiesSchema.parse(payload).features;
}

export function useFeatureCapabilities(): FeatureCapabilities {
  const [features, setFeatures] = useState<FeatureCapabilities>(DEFAULT_FEATURE_CAPABILITIES);

  useEffect(() => {
    let isMounted = true;

    void fetchFeatureCapabilities()
      .then((nextFeatures) => {
        if (isMounted) {
          setFeatures(nextFeatures);
        }
      })
      .catch(() => {
        if (isMounted) {
          setFeatures(DEFAULT_FEATURE_CAPABILITIES);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return features;
}
