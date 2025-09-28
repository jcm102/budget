'use server';

/**
 * @fileoverview This file is the entrypoint for all Genkit flow definitions.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {firebase} from '@genkit-ai/firebase';
import {dotprompt} from '@genkit-ai/dotprompt';
import {googleCloud} from '@genkit-ai/google-cloud';

// Import all flow definitions.
import '@/ai/flows/calculate-distance';
import '@/ai/flows/generate-task-description';
import '@/ai/flows/get-place-predictions';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: ['v1', 'v1beta'],
    }),
    googleCloud(),
    firebase(),
    dotprompt(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
