"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { AlertCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/client";

interface NewsletterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TURNSTILE_SITE_KEY =
  process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] || "0x4AAAAAABjmlf52zjynI4u4";

export function NewsletterModal({ open, onOpenChange }: NewsletterModalProps): React.JSX.Element {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);
  const { dict } = useI18n();

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError("");

    if (!turnstileToken) {
      setError(dict.newsletter.modal.errors.captcha);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          turnstileToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || dict.newsletter.modal.errors.failed);
      }

      // Show success message
      setSuccessMessage(data.message || dict.newsletter.modal.checkEmail);
      setIsSubmitted(true);

      // Close modal after longer delay for already subscribed
      const delay = data.alreadySubscribed ? 2000 : 3000;
      setTimeout(() => {
        onOpenChange(false);
        // Reset form after closing
        setTimeout(() => {
          setFirstName("");
          setLastName("");
          setEmail("");
          setIsSubmitted(false);
          setSuccessMessage("");
          setTurnstileToken("");
          turnstileRef.current?.reset();
        }, 300);
      }, delay);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.newsletter.modal.errors.failed);
      turnstileRef.current?.reset();
      setTurnstileToken("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTurnstileSuccess = (token: string): void => {
    setTurnstileToken(token);
    setError("");
  };

  const handleTurnstileError = (): void => {
    console.log("Turnstile error occurred, resetting widget");
    setError(dict.newsletter.modal.errors.failed);
    setTurnstileToken("");
    // Reset the Turnstile widget after error
    setTimeout(() => {
      if (turnstileRef.current) {
        turnstileRef.current.reset();
      }
    }, 1000);
  };

  const handleTurnstileExpire = (): void => {
    setTurnstileToken("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{dict.newsletter.modal.title}</DialogTitle>
          <DialogDescription>{dict.newsletter.modal.subtitle}</DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="py-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <p className="text-lg font-medium">{dict.newsletter.modal.thankYou}</p>
            <p className="text-sm text-muted-foreground mt-2">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{dict.newsletter.form.firstName}</Label>
                  <Input
                    id="firstName"
                    placeholder={dict.newsletter.modal.firstName}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{dict.newsletter.form.lastName}</Label>
                  <Input
                    id="lastName"
                    placeholder={dict.newsletter.modal.lastName}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{dict.newsletter.form.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={dict.newsletter.modal.email}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Turnstile CAPTCHA */}
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={handleTurnstileSuccess}
                onError={handleTurnstileError}
                onExpire={handleTurnstileExpire}
                options={{
                  theme: "light",
                  size: "normal",
                  retry: "auto",
                }}
              />
            </div>

            {error && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
                {error.includes("failed") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError("");
                      setTurnstileToken("");
                      if (turnstileRef.current) {
                        turnstileRef.current.reset();
                      }
                    }}
                  >
                    Retry Verification
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="flex-1" disabled={isSubmitting || !turnstileToken}>
                {isSubmitting ? dict.newsletter.form.subscribing : dict.newsletter.form.subscribe}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {dict.common.cancel}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {dict.newsletter.modal.privacyNote}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
