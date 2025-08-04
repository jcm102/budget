'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { getPlacePredictions } from '@/ai/flows/get-place-predictions';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Prediction = {
  description: string;
  place_id: string;
};

type AddressAutocompleteInputProps = {
  field: any; // from react-hook-form
  onSelect: (address: string) => void;
};

export function AddressAutocompleteInput({ field, onSelect }: AddressAutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(field.value || '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchPredictions = async () => {
      if (inputValue.length > 2) {
        setIsLoading(true);
        setShowPredictions(true);
        try {
          const result = await getPlacePredictions({ input: inputValue });
          setPredictions(result.predictions);
        } catch (error) {
          console.error('Failed to fetch place predictions:', error);
          setPredictions([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setPredictions([]);
        setShowPredictions(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchPredictions();
    }, 500); // 500ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const handleSelect = (prediction: Prediction) => {
    setInputValue(prediction.description);
    onSelect(prediction.description);
    setShowPredictions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    field.onChange(e.target.value);
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <Input
        {...field}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => { if(predictions.length > 0) setShowPredictions(true)}}
        autoComplete="off"
        className="pr-8"
      />
      {isLoading && (
         <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showPredictions && predictions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
          <ul className="py-1">
            {predictions.map((p) => (
              <li
                key={p.place_id}
                onClick={() => handleSelect(p)}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
              >
                {p.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
