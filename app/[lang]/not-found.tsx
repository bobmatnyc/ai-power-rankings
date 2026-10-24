import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotFoundPanel } from "@/components/ui/not-found-panel";

// #193: design-system Card, Button and `--ds-*` tokens replace the inline styles and hex colours.
export default function NotFound() {
  return (
    <NotFoundPanel title="Page Not Found" message="Sorry, we couldn't find the page you're looking for.">
      {/* #190: hover/active variants hold the colour against globals.css a:hover and a:active. */}
      <Button asChild className="hover:text-primary-foreground active:text-primary-foreground">
        <Link href="/">Return Home</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/en">View Rankings</Link>
      </Button>
    </NotFoundPanel>
  );
}
