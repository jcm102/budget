'use server';

/**
 * @fileOverview A flow to get place predictions from the Google Maps Places API.
 * 
 * - getPlacePredictions - A function that returns address suggestions.
 * - GetPlacePredictionsInput - The input type for the getPlacePredictions function.
 * - GetPlacePredictionsOutput - The return type for the getPlacePredictions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fetch from 'node-fetch';

const GetPlacePredictionsInputSchema = z.object({
  input: z.string().describe('The partial address text to search for.'),
});
export type GetPlacePredictionsInput = z.infer<typeof GetPlacePredictionsInputSchema>;

const PlacePredictionSchema = z.object({
    description: z.string(),
    place_id: z.string(),
});

const GetPlacePredictionsOutputSchema = z.object({
    predictions: z.array(PlacePredictionSchema).describe('A list of address predictions.'),
});
export type GetPlacePredictionsOutput = z.infer<typeof GetPlacePredictionsOutputSchema>;

export async function getPlacePredictions(input: GetPlacePredictionsInput): Promise<GetPlacePredictionsOutput> {
  return getPlacePredictionsFlow(input);
}

const getPlacePredictionsFlow = ai.defineFlow(
  {
    name: 'getPlacePredictionsFlow',
    inputSchema: GetPlacePredictionsInputSchema,
    outputSchema: GetPlacePredictionsOutputSchema,
  },
  async ({ input }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured.');
    }

    if (!input) {
        return { predictions: [] };
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', data.error_message || data.status);
      throw new Error(`Failed to get place predictions. Status: ${data.status}`);
    }

    return {
      predictions: data.predictions || [],
    };
  }
);