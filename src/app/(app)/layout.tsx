"use client";

import {
  BeautifulOnboarder,
  type OnboardingStep,
} from "@/components/BeautifulOnboarder";
import { CommandPalette } from "@/components/CommandPalette";
import { RegisterHotkeys } from "@/components/RegisterHotkeys";
import { APP_NAME } from "@/config/config";
import { userHotkeys } from "@/config/hotkeys";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsImpersonating } from "@/hooks/useIsImpersonating";
import AppHeader from '@/components/core/AppHeader';
import { Spinner } from '@/components/Spinner';
import { CustomButton } from '@/components/CustomButton';

// Define steps for onboarding
const onboardingSteps: OnboardingStep[] = [
  {
    key: "welcome",
    content: ({}) => (
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold text-white drop-shadow-lg">
          Welcome to {APP_NAME}!
        </h1>
        <p className="mx-auto max-w-md text-lg text-white drop-shadow">
          Your secure, encrypted Bitcoin transaction manager.
        </p>
      </div>
    ),
  },
  {
    key: "encryption",
    content: ({}) => (
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold text-white drop-shadow-lg">
          Secure Your Data
        </h1>
        <p className="mx-auto max-w-md text-lg text-white drop-shadow">
          We'll help you set up end-to-end encryption for your transactions. Your data stays private and secure.
        </p>
      </div>
    ),
  },
  {
    key: "features",
    content: ({}) => (
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold text-white drop-shadow-lg">
          Key Features
        </h1>
        <p className="mx-auto max-w-md text-lg text-white drop-shadow">
          Discover all the powerful tools at your disposal.
        </p>
      </div>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isError } = useCurrentUser();
  const { isImpersonating } = useIsImpersonating();
  const showOnboarding = user && !user.onboarded && !isImpersonating;

  if (isLoading) return <Spinner />;
  if (isError) return <div className="text-center text-red-500">Error loading user.</div>;
  if (!user) return <div className="text-center"><CustomButton>Sign In</CustomButton></div>;

  return (
    <>
      {/* global hotkeys that apply only when user is logged in */}
      <RegisterHotkeys hotkeys={userHotkeys} />
      <CommandPalette />
      {showOnboarding && <BeautifulOnboarder steps={onboardingSteps} />}
      <AppHeader />
      <main>{children}</main>
    </>
  );
}
