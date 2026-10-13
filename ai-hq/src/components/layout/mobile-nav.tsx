"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav, SidebarNavFallback } from "./sidebar-nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="px-3 py-5">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">AI HQ sections</SheetDescription>
        <Link href="/" className="px-3" onClick={() => setOpen(false)}>
          <Logo />
        </Link>
        <div className="mt-4 overflow-y-auto">
          <Suspense fallback={<SidebarNavFallback />}>
            <SidebarNav onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
