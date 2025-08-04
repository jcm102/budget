import { config } from 'dotenv';
config();

import '@/ai/flows/generate-task-description.ts';
import '@/ai/flows/calculate-distance.ts';
import '@/ai/flows/get-place-predictions.ts';
