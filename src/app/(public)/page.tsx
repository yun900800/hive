import { auth } from "@/auth";
import { listPlans } from "@/modules/membership/application/membership-app";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks, Differentiators } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { CtaBanner } from "@/components/landing/cta-banner";

export default async function HomePage() {
  const session = await auth();
  const [plans] = await Promise.all([listPlans()]);

  return (
    <>
      <Hero isAuthenticated={Boolean(session?.user)} />
      <Features />
      <Pricing plans={plans} />
      <HowItWorks />
      <Differentiators />
      <CtaBanner />
    </>
  );
}
