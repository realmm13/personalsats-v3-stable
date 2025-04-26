"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { createAvatar } from "@dicebear/core";
import { lorelei } from "@dicebear/collection";
import { motion } from "framer-motion";
import { APP_NAME } from "@/config/config";
import { SmoothLoadImage } from "@/components/SmoothLoadImage";
import { CustomButton } from "@/components/CustomButton";
import { CustomBadge } from "@/components/CustomBadge";

// Animated avatar group component
const AvatarGroup = ({ avatars }: { avatars: string[] }) => {
  return (
    <div className="flex -space-x-2">
      {avatars.map((avatar, i) => (
        <motion.div
          key={i}
          className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-white dark:border-gray-950"
          initial={{ opacity: 0, x: -10, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: i * 0.1 + 0.6, duration: 0.3 }}
          whileHover={{ y: -3, zIndex: 10, transition: { duration: 0.2 } }}
        >
          <Image
            src={avatar}
            alt={`User ${i + 1}`}
            fill
            className="object-cover"
          />
        </motion.div>
      ))}
    </div>
  );
};

export default function LandingHero() {
  // Generate DiceBear avatar seeds
  const avatars = [1, 2, 3, 4].map((i) =>
    createAvatar(lorelei, {
      seed: `user-${i}`,
      backgroundColor: ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf"],
    }).toDataUri(),
  );

  return (
    <section className="w-full py-12 md:mt-18 md:py-24 lg:py-32">
      <div className="container mx-auto flex flex-col items-center px-4 md:flex-row md:px-6">
        <motion.div
          className="mb-12 flex flex-col items-center space-y-6 text-center md:mb-0 md:w-1/2 md:items-start md:text-left"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="mb-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary dark:bg-primary/20 dark:text-primary"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            Introducing {APP_NAME}
          </motion.div>

          <motion.h1
            className="text-4xl leading-tight font-bold tracking-tight md:text-5xl lg:text-6xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Own Your {" "}
            <span className="text-primary">Bitcoin</span>{" "}
            Records With {APP_NAME}
          </motion.h1>

          <motion.p
            className="max-w-md text-lg text-gray-600 dark:text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            Forget spreadsheets and complicated apps. Personal Sats helps you stay on top of your Bitcoin transactions, cost basis, and taxes. Just your sats, your records.
          </motion.p>

          <motion.div
            className="flex flex-col items-center gap-4 sm:flex-row md:items-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <CustomButton href="/signup" size="lg" color="primary">
              Get Started Free
            </CustomButton>

            <CustomButton href="/demo" variant="outline" color="foreground" size="lg" rightIcon={ArrowRight}>
              Watch Demo
            </CustomButton>
          </motion.div>

          <motion.div
            className="mt-4 flex items-center justify-center space-x-4 md:justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <AvatarGroup avatars={avatars} />
            <motion.p
              className="text-sm text-gray-600 dark:text-gray-400"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.3 }}
            >
              <span className="font-medium">2,000+</span> happy users
            </motion.p>
          </motion.div>
        </motion.div>

        <motion.div
          className="relative flex justify-center md:w-1/2"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative h-auto min-h-[280px] w-[90%] max-w-[450px]">
            <SmoothLoadImage
              src="/bitcointaxmannew.png"
              alt="Dashboard Preview"
              objectFit="contain"
              priority
              className="h-full w-full"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
