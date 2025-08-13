"use client";

import { ArrowRight } from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Removed Supabase client import - now handled by JWT auth system
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api/client";

export function OnboardingForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { theme, systemTheme } = useTheme();

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    try {
      await api.user.onboard({
        email,
        displayName: displayName.trim(),
        password: "temp-password-123", // TODO: Add password field
      });
      
      // JWT token is set via cookie during onboard mutation
      // No additional client-side auth verification needed
      router.push("/mine");
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("An unexpected error occurred");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-3">
        <div className="bg-primary/10 px-4 py-2 rounded-lg">
          <span className="text-xl font-bold">Helper CE</span>
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Welcome! Let's set up your Helper Community Edition account</p>
          <p className="text-xs text-muted-foreground mt-1">
            Helper is a trademark of Gumroad, Inc.
          </p>
        </div>
      </div>
      <form onSubmit={handleFormSubmit}>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email" className="sr-only">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName" className="sr-only">
              Display Name
            </Label>
            <Input
              id="displayName"
              type="text"
              required
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <Button
            variant="bright"
            type="submit"
            className="w-full"
            disabled={!email || !displayName.trim() || isLoading}
          >
            {isLoading ? "Setting up your account..." : "Start using Helper CE"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </div>
      </form>
    </div>
  );
}
