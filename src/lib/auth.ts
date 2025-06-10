import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export function getAuth() {
  const { userId } = auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  return { userId };
} 