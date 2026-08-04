
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Delete, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Calculator({ onUseResult }: { onUseResult?: (result: string) => void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const { toast } = useToast();

  const handleInput = (value: string) => {
    if (result === 'Error') {
        clearInput();
        setInput(value);
        return;
    }
    if (result) {
      setInput(result + value);
      setResult('');
    } else {
      setInput(input + value);
    }
  };

  const calculateResult = () => {
    if (result === 'Error' || !input) return;
    try {
      // Using a safer evaluation method
      const calculatedResult = new Function('return ' + input)();
      const roundedResult = parseFloat(calculatedResult.toFixed(2));
      setResult(String(roundedResult));
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

  const handleCopy = () => {
    const valueToCopy = result || input;
    if (valueToCopy && valueToCopy !== 'Error') {
        navigator.clipboard.writeText(valueToCopy).then(() => {
            toast({
                title: 'Copied to Clipboard!',
                description: `Value: ${valueToCopy}`
            })
        });
    }
  };
  
  const handleUseResult = () => {
    const valueToUse = result || (input && !isNaN(Number(input)) ? input : '');
    if (onUseResult && valueToUse && valueToUse !== 'Error') {
        onUseResult(valueToUse);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key;

      if (/[0-9]/.test(key) || ['+', '-', '*', '/', '(', ')', '.'].includes(key)) {
        e.preventDefault();
        handleInput(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculateResult();
      } else if (key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        e.preventDefault();
        clearInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input, result]);

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
    <Card className="h-full flex flex-col border-none shadow-none">
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
                    className={cn('h-14 text-2xl', btn.className)}
                >
                    {btn.label}
                </Button>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
             <Button
                onClick={backspace}
                variant="outline"
                className="h-14 text-2xl"
             >
                <Delete className="h-8 w-8"/>
             </Button>
             <Button
                onClick={handleCopy}
                variant="outline"
                className="h-14 text-2xl"
             >
                <Copy className="h-8 w-8"/>
             </Button>
        </div>
         {onUseResult && (
            <Button onClick={handleUseResult} className="mt-4 w-full h-14 text-lg">Use Result</Button>
        )}
      </CardContent>
    </Card>
  );
}
