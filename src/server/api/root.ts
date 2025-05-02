import { userRouter } from "@/server/api/routers/user";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { utImageRouter } from "./routers/utImage";
import { polarRouter } from "./routers/polar";
import { authRouter } from "./routers/auth";
import { adminRouter } from "./routers/admin";
import { taxRouter } from "./routers/tax";
import { priceRouter } from "./routers/price";
import { userSettingsRouter } from "./routers/userSettings";
import { transactionsRouter } from "./routers/transactions";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  user: userRouter,
  utImage: utImageRouter,
  polar: polarRouter,
  auth: authRouter,
  admin: adminRouter,
  tax: taxRouter,
  price: priceRouter,
  userSettings: userSettingsRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
