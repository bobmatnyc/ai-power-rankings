import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Force static generation to avoid Html import issue
export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-6xl font-bold text-gray-900">404</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-gray-800">Page Not Found</h2>
          <p className="text-gray-600">
            Sorry, we couldn't find the page you're looking for.
          </p>
          <div className="flex flex-col gap-2 pt-4">
            <Button asChild>
              <Link href="/">Return Home</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/en">View Rankings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}