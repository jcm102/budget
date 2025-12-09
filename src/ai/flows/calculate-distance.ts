'use server';

/**
 * @fileOverview A flow to calculate the distance between two addresses using the Google Maps Directions API.
 * 
 * - calculateDistance - A function that calculates the distance.
 * - CalculateDistanceInput - The input type for the calculateDistance function.
 * - CalculateDistanceOutput - The return type for the calculateDistance function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fetch from 'node-fetch';

const CalculateDistanceInputSchema = z.object({
  origin: z.string().describe('The starting address.'),
  destination: z.string().describe('The ending address.'),
});
export type CalculateDistanceInput = z.infer<typeof CalculateDistanceInputSchema>;

const CalculateDistanceOutputSchema = z.object({
  distance: z.number().describe('The distance in kilometers.'),
});
export type CalculateDistanceOutput = z.infer<typeof CalculateDistanceOutputSchema>;

export async function calculateDistance(input: CalculateDistanceInput): Promise<CalculateDistanceOutput> {
  return calculateDistanceFlow(input);
}

const calculateDistanceFlow = ai.defineFlow(
  {
    name: 'calculateDistanceFlow',
    inputSchema: CalculateDistanceInputSchema,
    outputSchema: CalculateDistanceOutputSchema,
  },
  async ({ origin, destination }) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured.');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;

    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
      console.error('Directions API error:', data.error_message || data.status);
      throw new Error(`Failed to calculate distance. Status: ${data.status}`);
    }

    // Get the distance in meters from the first leg of the first route
    const distanceInMeters = data.routes[0].legs[0].distance.value;
    const distanceInKm = distanceInMeters / 1000;

    return {
      distance: distanceInKm,
    };
  }
);