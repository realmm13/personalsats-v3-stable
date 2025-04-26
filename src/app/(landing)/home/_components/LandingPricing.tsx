"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CustomButton } from "@/components/CustomButton";
import { CustomBadge } from "@/components/CustomBadge";
import { APP_NAME } from "@/config/config";
import LandingSectionTitle from "./LandingSectionTitle";

function DiscountBadge() {
  return (
    <CustomBadge color="primary" size="sm" className="px-4 py-1">
      <span className="mr-1 text-xs">🎉</span> Limited time offer: 20% off
      annual plans
    </CustomBadge>
  );
}

function GetStartedButton({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "muted" | "annual";
  className?: string;
}) {
  const isPrimary = variant === "annual";
  const buttonVariant = variant === "muted" ? "outline" : isPrimary ? undefined : undefined;
  const buttonColor = isPrimary ? "primary" : variant === "muted" ? "foreground" : "secondary";

  return (
    <CustomButton
      className={`${className} group`}
      variant={buttonVariant}
      color={buttonColor}
    >
      Get started
      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
    </CustomButton>
  );
}

export default function LandingPricing() {
  const planVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
  };

  return (
    <section id="pricing" className="w-full py-24">
      <div className="container mx-auto px-4">
        <LandingSectionTitle
          title="Simple, transparent pricing"
          description={`Try ${APP_NAME} free for 7 days. No credit card required.`}
        />
        <div className="mt-4 flex justify-center">
          <DiscountBadge />
        </div>

        <motion.div
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div
            className="rounded-2xl border border-gray-200 p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900/50"
            variants={planVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Monthly
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              For individuals exploring productivity tools
            </p>
            <p className="mt-8">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                $19
              </span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
            </p>
            <GetStartedButton variant="muted" className="mt-8 w-full" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Flexible month-to-month plan with all essential features to boost
              your productivity.
            </p>
          </motion.div>

          <motion.div
            className="relative rounded-2xl border-2 border-primary bg-primary/10 p-8 shadow-lg dark:border-primary dark:bg-primary/10"
            variants={planVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
              Most Popular
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Annual
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              For committed professionals and teams
            </p>
            <p className="mt-8">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                $15
              </span>
              <span className="text-gray-600 dark:text-gray-400">/month</span>
            </p>
            <div className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary-foreground dark:bg-primary/20 dark:text-primary-foreground">
              <span className="font-medium">Save $48/year</span> with our annual
              billing plan
            </div>
            <GetStartedButton variant="annual" className="mt-8 w-full" />
            <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Priority customer
                support
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Advanced analytics
                and reporting
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Additional team
                collaboration features
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
