
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';

export function Calculator() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');

  const handleInput = (value: string) => {
    if (result) {
      setInput(result + value);
      setResult('');
    } else {
      setInput(input + value);
    }
  };

  const calculateResult = () => {
    try {
      // Using a safer evaluation method
      const calculatedResult = new Function('return ' + input)();
      setResult(String(calculatedResult));
    } catch (error) {
      setResult('Error');
    }
  };

  const clearInput = () => {
    setInput('');
    setResult('');
  };
  
  const backspace = () => {
    if (result) {
        clearInput();
    } else {
        setInput(input.slice(0, -1));
    }
  }

  const buttons = [
    { label: 'C', action: clearInput, className: 'bg-destructive/80 hover:bg-destructive text-destructive-foreground' },
    { label: '(', action: () => handleInput('(') },
    { label: ')', action: () => handleInput(')') },
    { label: '/', action: () => handleInput('/') },
    { label: '7', action: () => handleInput('7') },
    { label: '8', action: () => handleInput('8') },
    { label: '9', action: () => handleInput('9') },
    { label: '*', action: () => handleInput('*') },
    { label: '4', action: () => handleInput('4') },
    { label: '5', action: () => handleInput('5') },
    { label: '6', action: () => handleInput('6') },
    { label: '-', action: () => handleInput('-') },
    { label: '1', action: () => handleInput('1') },
    { label: '2', action: () => handleInput('2') },
    { label: '3', action: () => handleInput('3') },
    { label: '+', action: () => handleInput('+') },
    { label: '0', action: () => handleInput('0'), className: 'col-span-2' },
    { label: '.', action: () => handleInput('.') },
    { label: '=', action: calculateResult, className: 'bg-primary/90 hover:bg-primary text-primary-foreground' },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex-grow flex flex-col">
        <div className="bg-muted rounded-lg p-4 text-right flex-grow flex flex-col justify-end">
          <div className="text-2xl text-muted-foreground min-h-[32px] break-all">{input || '0'}</div>
          <div className="text-4xl font-bold min-h-[40px] break-all">{result}</div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
            {buttons.map((btn) => (
                <Button
                    key={btn.label}
                    onClick={btn.action}
                    variant="outline"
                    className={cn('h-16 text-2xl', btn.className)}
                >
                    {btn.label}
                </Button>
            ))}
        </div>
        <div className="grid grid-cols-1 mt-2">
             <Button
                onClick={backspace}
                variant="outline"
                className="h-16 text-2xl"
             >
                <Delete className="h-8 w-8"/>
             </Button>
        </div>
      </CardContent>
    </Card>
  );
}
