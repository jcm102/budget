'use server';

import { genkit } from 'genkit';
import { dotprompt } from '@genkit-ai/dotprompt';
// Note: Ensure your genkit instance is configured correctly here
// or import a pre-configured instance from a lib file.

/**
 * Server Action to generate task descriptions using Genkit.
 * This runs ONLY on the server, avoiding Webpack errors.
 */
export async function generateTaskDescription(taskTitle: string) {
  try {
    // Basic example of a Genkit call
    // Replace this with your specific Genkit flow/prompt logic
    console.log("Generating description for:", taskTitle);
    
    // Example: const response = await ai.generate(`Describe: ${taskTitle}`);
    // return response.text();
    
    return `Automated description for: ${taskTitle}`; 
  } catch (error) {
    console.error("Genkit Error:", error);
    throw new Error("Failed to generate AI description");
  }
}