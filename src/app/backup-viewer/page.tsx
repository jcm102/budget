
import fs from 'fs';
import path from 'path';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

async function getBackupData() {
  try {
    const filePath = path.join(process.cwd(), 'backup.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error reading backup file:', error);
    return null;
  }
}

export default async function BackupViewerPage() {
  const backupData = await getBackupData();

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main>
        <Card>
            <CardHeader>
                <CardTitle>Backup Data Viewer</CardTitle>
                <CardDescription>
                   This is a temporary page showing the contents of your `backup.json` file. Please copy the data you need. The `monthly-budget-items` section contains your lost budget information.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {backupData ? (
                    <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
                        {JSON.stringify(backupData, null, 2)}
                    </pre>
                ) : (
                    <div className="p-8 text-center text-destructive-foreground bg-destructive rounded-md">
                        <h3 className="text-lg font-semibold">Error: `backup.json` not found</h3>
                        <p>Could not find or read the backup file in your project's root directory.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
